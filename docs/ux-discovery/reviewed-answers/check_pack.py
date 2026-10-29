"""Read-only structural/content-integrity checks; writes only its JSON/report here.
No application code is imported, no app tests/database/network calls are made.
"""
from pathlib import Path
from urllib.parse import unquote
from collections import Counter
import re, json, hashlib, sys
from functools import lru_cache

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
def read(p):return Path(p).read_text(encoding='utf-8-sig')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def slug(s):
    s=re.sub(r'<[^>]+>','',s).strip().lower()
    s=re.sub(r'[^\w\- ]','',s)
    return s.replace(' ','-')
@lru_cache(maxsize=None)
def anchors(p):
    counts=Counter();result=set()
    for h in re.findall(r'^#{1,6} (.+)$',read(p),re.M):
        a=slug(h);n=counts[a];counts[a]+=1;result.add(a+(f'-{n}' if n else ''))
    result.update(re.findall(r'<a\s+(?:id|name)=["\']([^"\']+)',read(p)))
    return result

errors=[];checks=[]
def check(label,ok,detail):
    checks.append(dict(check=label,passed=bool(ok),detail=detail))
    if not ok:errors.append(label+': '+str(detail))

canonical=read(ROOT/'docs/ux-discovery/questionnaire.md')
questions=re.findall(r'^- \*\*(S\d\d\.\d\d)\*\* (.+)$',canonical,re.M)
answers=read(OUT/'answers.md')
heads=re.findall(r'^### (S\d\d\.\d\d)$',answers,re.M)
qtext=re.findall(r'^\*\*Question:\*\* (.+)$',answers,re.M)
check('Canonical question IDs/order/uniqueness',heads==[x[0] for x in questions] and len(heads)==len(set(heads)),{'canonical':len(questions),'answers':len(heads),'unique':len(set(heads))})
check('Original exact question wording',qtext==[x[1] for x in questions],{'question_texts':len(qtext)})
sectionheads=re.findall(r'^## (S\d\d) —',answers,re.M)
check('All canonical sections',sectionheads==re.findall(r'^## (S\d\d) —',canonical,re.M),sectionheads)
answerblocks=re.split(r'^### S\d\d\.\d\d\s*$',answers,flags=re.M)[1:]
required=['**Question:**','**Disposition:**','**Release:**','**Authority/evidence:**','**Owner / operational approval:**','**Dependencies / detailed behavior:**','**Acceptance:**']
missing=[heads[i] for i,b in enumerate(answerblocks) if not all(k in b for k in required)]
check('Required per-question answer metadata',not missing,missing)
criteria=json.loads(read(OUT/'acceptance-criteria.json'))
check('Question-specific acceptance coverage',set(criteria)==set(heads) and len(set(criteria.values()))==len(heads),len(criteria))

canon_cases=re.findall(r'^\| (A\d\d) \| (.+?) \| (.+?) \|$',canonical,re.M)
sc=read(OUT/'scenario-walkthroughs.md')
caseheads=re.findall(r'^## (A\d\d)$',sc,re.M)
casewords=re.findall(r'^\*\*Canonical scenario:\*\* (.+)$',sc,re.M)
casemaps=re.findall(r'^\*\*Canonical question mapping:\*\* (.+)\.$',sc,re.M)
check('All scenario IDs/order/wording/mapping',caseheads==[a[0] for a in canon_cases] and casewords==[a[1] for a in canon_cases] and casemaps==[a[2] for a in canon_cases],len(caseheads))
for label in ['Fictional starting data','Permitted actors / screens','Messages and notices','Failure / cancellation / recovery','Expected end state and data/audit evidence','Acceptance decision']:
    check('Scenario component: '+label,sc.count('**'+label+':**')==len(canon_cases),sc.count('**'+label+':**'))

wf=read(OUT/'workflow-specifications.md'); wids=re.findall(r'^## (WF\d\d)$',wf,re.M)
forms=read(OUT/'field-dictionary.md');fids=re.findall(r'^## (FM\d\d)$',forms,re.M)
notifications=read(OUT/'notification-matrix.md');nids=re.findall(r'^## (WF\d\d)$',notifications,re.M)
check('Workflow/form/notification section mapping',len(wids)==65 and len(set(wids))==65 and [f'FM{w[2:]}' for w in wids]==fids and wids==nids,{'workflows':len(wids),'forms':len(fids),'notice_groups':len(nids)})
cardrows=['Entry and trigger','Data','Lifecycle','Transitions','Visibility','Ownership and time','Corrections and exceptions','Communication','End result','Acceptance']
wfblocks=re.split(r'^## WF\d\d\s*$',wf,flags=re.M)[1:]
cardmissing=[wids[i] for i,b in enumerate(wfblocks) if not all('| '+k+' |' in b for k in cardrows)]
check('All ten rows on every workflow card',not cardmissing,cardmissing)
trans=json.loads(read(OUT/'transition-inventory.json'))
missingtrans=[t['id'] for t in trans if '| '+t['id']+' |' not in notifications or '| '+t['id']+' |' not in wf]
check('Every defined transition in workflow and notification tables',not missingtrans,{'transitions':len(trans),'missing':missingtrans})
fields=json.loads(read(OUT/'field-inventory.json'))
missingfields=[f['id'] for f in fields if '| '+f['id']+' |' not in forms]
check('Explicit field-binding rows and unique IDs',not missingfields and len(fields)==len({f['id'] for f in fields}),{'bindings':len(fields),'missing':missingfields})
check('No empty form',set(f['form'] for f in fields)==set(fids),sorted(set(f['form'] for f in fields)))

mds=sorted(OUT.glob('*.md'))
broken=[];external=set();local_count=0
for p in mds:
    for target in re.findall(r'(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)',read(p)):
        target=target.strip('<>')
        if target.startswith(('http://','https://')):external.add(target);continue
        if '://' in target:continue
        path,_,anchor=unquote(target).partition('#')
        path=re.sub(r':\d+$','',path)
        if re.match(r'^/[A-Za-z]:/',path):path=path[1:]
        dest=Path(path) if re.match(r'^[A-Za-z]:[\\/]',path) or path.startswith('/') else p.parent/path if path else p
        local_count+=1
        if not dest.exists():broken.append((p.name,target,'missing file'))
        elif anchor and dest.suffix=='.md' and anchor not in anchors(dest):broken.append((p.name,target,'missing anchor'))
check('Local Markdown links and anchors',not broken,{'checked':local_count,'broken':broken[:100]})
manifest=json.loads(read(OUT/'source-manifest.json'))
changed=[p for p,digest in manifest.items() if not Path(p).exists() or sha(p)!=digest]
check('Original questionnaire/owner files/drafts/prompt preserved',not changed,{'hashed_originals':len(manifest),'changed':changed})

check('No unrelated implementation instructions in answers','BARBERSHOP MANAGEMENT SYSTEM' not in answers and 'BARBERSHOP MANAGEMENT SYSTEM' not in wf, 'Unrelated source material excluded; report may identify its heading.')
check('No unresolved old appendix references',not re.search(r'\bAppendix [BCD]\b',answers.replace('replacing the older draft’s Appendix C reference','').replace('replacing Appendix B','').replace('replace the earlier Appendix D input reference','')), 'Old source references replaced with actual pack files.')
check('No generic question acceptance fallback','Apply the stated decision to its mapped workflow/screen' not in answers,'Every canonical question has authored observable criterion.')
check('No obsolete ordinary 12-character recommendation','12 characters for ordinary new credentials' not in answers,'Reviewed 16–200 proposal used; prior source remains preserved.')
check('Combined-home owner direction retained','one combined home' in answers.lower() and 'No prior digital instruction/delegation or repeat online approval' in answers,'Explicit source direction and effective prior-instruction recording preserved.')
check('No TODO/TBD answer placeholders',not re.search(r'\b(?:TODO|TBD|FIXME)\b',answers+'\n'+sc),'Missing real facts are explicit U inputs, not unexplained placeholders.')
result=dict(status='PASS' if not errors else 'FAIL',counts=dict(questions=len(heads),sections=len(sectionheads),scenarios=len(caseheads),workflows=len(wids),forms=len(fids),field_bindings=len(fields),transitions=len(trans),local_links_checked=local_count),checks=checks,errors=errors,external_references=sorted(external),scope='Documentation integrity and stated cross-reference invariants only; not semantic proof, runtime validation, jurisdiction policy approval or user testing.')
(OUT/'check-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result['counts'],ensure_ascii=False,indent=2));print(result['status'])
if errors:print('\n'.join(errors))
sys.exit(bool(errors))
