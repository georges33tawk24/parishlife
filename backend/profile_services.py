"""Office-reviewed updates to linked parish records, separate from login identities."""
import datetime as dt
import json
import secrets
from pathlib import Path
from . import workspace as w

FIELDS = {'name','nameAr','birthDate','phone','email','occupation','language','governorate','district','town','townAr','sector'}


def snapshot(state, person):
    extra = state.get('PERSON_EXTRA', {}).get(person['id'], {})
    address = extra.get('address', {})
    if not isinstance(address, dict): address = {}
    return dict(name=person.get('lat',''), nameAr=person.get('ar',''), birthDate=person.get('born',''),
                phone=person.get('phone',''), email=person.get('email',''), occupation=extra.get('occupation',''),
                language=extra.get('lang',''), **{k:address.get(k,person.get(k,'')) for k in ('governorate','district','town','townAr','sector')})


def notify(c, pid, uid, title, route):
    c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',
              (secrets.token_hex(12),pid,uid,'profile',title,'',route,w.now()))


def handle(c,u,path,method,q,require):
    if path not in {'/api/account/records','/api/workspace/profile-reviews'}: return None
    office = path.startswith('/api/workspace/')
    if method=='GET' and not office:
        records=[]
        for parish in w.accessible_parishes(c,u):
            state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(parish['id'],)).fetchone()['data'])
            person=next((p for p in state['PEOPLE'] if p['id']==parish['personId']),None)
            if person:
                records.append({'parish':parish['id'],'parishName':parish['name'],'profile':snapshot(state,person)})
        requests=[{**dict(r),'data':json.loads(r['data'])} for r in c.execute('SELECT * FROM pl_profile_reviews WHERE user_id=? ORDER BY created_at DESC',(u['id'],))]
        return {'records':records,'requests':requests}
    pid=q.get('parish')
    context=w.parish_context(c,u,pid)
    require(context,'Parish access required.',403)
    if office:
        require(w.office_access(c,u,pid),'Parish office access required.',403)
        if method=='GET':
            return {'requests':[{**dict(r),'data':json.loads(r['data'])} for r in c.execute('SELECT r.*,u.name FROM pl_profile_reviews r JOIN users u ON u.id=r.user_id WHERE r.parish_id=? ORDER BY r.created_at DESC',(pid,))]}
    require(method=='POST','Method not allowed.',405)
    row=c.execute('SELECT revision,data FROM states WHERE parish_id=?',(pid,)).fetchone()
    state=json.loads(row['data'])
    if not office:
        person=next((p for p in state['PEOPLE'] if p['id']==context['person_id']),None)
        require(person,'The office must first link your parish person record.',409)
        require(not c.execute("SELECT 1 FROM pl_profile_reviews WHERE user_id=? AND parish_id=? AND status='pending'",(u['id'],pid)).fetchone(),'Your previous changes are still with the office.',409)
        values=q.get('profile')
        require(isinstance(values,dict) and set(values)<=FIELDS,'Invalid profile fields.')
        require(all(isinstance(v,str) and len(v)<=500 for v in values.values()),'Keep each field within 500 characters.')
        values={k:v.strip() for k,v in values.items()}
        before=snapshot(state,person)
        merged={**before,**values}
        require(1<=len(merged['name'])<=120 and len(merged['nameAr'])<=120,'Enter a name of up to 120 characters.')
        require(not merged['email'] or w.EMAIL.fullmatch(merged['email']),'Enter a valid email.')
        if merged['birthDate']:
            try: born=dt.date.fromisoformat(merged['birthDate'])
            except ValueError: require(False,'Enter a valid date of birth.')
            require(born<=dt.date.today(),'Date of birth cannot be in the future.')
        require(not any(merged[k] for k in ('governorate','district','town')) or all(merged[k] for k in ('governorate','district','town')),'Complete governorate, district and town together.')
        require(len(merged['occupation'])<=120,'Keep the occupation within 120 characters.')
        if any(merged[k]!=before[k] for k in ('governorate','district','town','sector')) and any(merged[k] for k in ('governorate','district','town','sector')):
            locations=json.loads(Path(__file__).with_name('geography.json').read_text(encoding='utf-8'))['governorates']
            gov=next((g for g in locations if g['id']==merged['governorate']),{})
            district=next((d for d in gov.get('districts',[]) if d['id']==merged['district']),{})
            town=next((t for t in district.get('towns',[]) if t['id']==merged['town']),None)
            require(town and (not merged['sector'] or any(x['id']==merged['sector'] for x in town.get('sectors',[]))),'Choose a valid Governorate, District, Town and Sector combination.')
            values['townAr']=town['ar']
        changes={k:v for k,v in values.items() if v!=before[k]}
        require(changes,'No changes to submit.')
        rid=secrets.token_hex(12)
        c.execute('INSERT INTO pl_profile_reviews VALUES(?,?,?,?,?,?,?,?,?)',(rid,pid,u['id'],person['id'],json.dumps({'before':{k:before[k] for k in changes},'changes':changes}),'pending',w.now(),None,None))
        for target in c.execute('SELECT * FROM users'):
            target_context=w.parish_context(c,target,pid)
            if target_context and w.is_office(target_context):
                notify(c,pid,target['id'],'Parish profile changes awaiting review','profilereviews')
        w.history(c,u,pid,'profile.review.requested',{'id':rid})
        return {'ok':True,'id':rid}
    request=c.execute('SELECT * FROM pl_profile_reviews WHERE id=? AND parish_id=?',(q.get('id'),pid)).fetchone()
    require(request and request['status']=='pending','Pending changes not found.',409)
    require(request['user_id']!=u['id'],'Another office user must review your own record changes.',403)
    status=q.get('status')
    require(status in {'approved','declined'},'Choose approve or decline.')
    if status=='approved':
        person=next((p for p in state['PEOPLE'] if p['id']==request['person_id']),None)
        require(person,'Person record no longer available.',409)
        data=json.loads(request['data']); current=snapshot(state,person)
        require(all(current[k]==v for k,v in data['before'].items()),'These fields changed after submission. Decline this request and ask for updated information.',409)
        extra=state.setdefault('PERSON_EXTRA',{}).setdefault(person['id'],{})
        for key,value in data['changes'].items():
            if key in {'name','nameAr','birthDate','phone','email'}:
                person[{'name':'lat','nameAr':'ar','birthDate':'born'}.get(key,key)]=value
            elif key in {'occupation','language'}: extra['lang' if key=='language' else key]=value
            else:
                if not isinstance(extra.get('address'),dict): extra['address']={}
                extra['address'][key]=value
                if key in {'town','townAr'}: person[key]=value
        c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',(json.dumps(state),pid))
    c.execute('UPDATE pl_profile_reviews SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?',(status,u['id'],w.now(),request['id']))
    notify(c,pid,request['user_id'],'Parish profile changes '+status,'account')
    w.history(c,u,pid,'profile.review.'+status,{'id':request['id']})
    return {'ok':True}
