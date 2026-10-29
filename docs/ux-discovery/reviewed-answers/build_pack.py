"""Build the documentation pack from canonical questions and reviewed authoring data.

Reads original documents; writes only within this directory. No application import.
"""
from pathlib import Path
import re, json, hashlib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
DESKTOP = Path('C:/Users/User/Desktop')
QFILE = ROOT / 'docs/ux-discovery/questionnaire.md'
OLD = ROOT / 'docs/ux-discovery/complete-questionnaire-answers.md'
SOURCES = [QFILE, OLD, ROOT/'docs/ux-discovery/decision-register.md', ROOT/'docs/ux-discovery/S01-S02-refined-answers.md', DESKTOP/'S01-S02-refined-answers.md', DESKTOP/'S03-S04-proposed-answers.md', ROOT/'docs/ux-discovery/codex-answering-prompt.md']

def read(p): return Path(p).read_text(encoding='utf-8-sig')
def write(name, text):
    p=OUT/name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text.rstrip()+'\n', encoding='utf-8')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def canonical():
    text=read(QFILE)
    qs=[]
    sections={}
    current=None
    for n,line in enumerate(text.splitlines(),1):
        m=re.match(r'## (S\d\d) — (.+)',line)
        if m: current=m[1]; sections[current]=m[2]
        m=re.match(r'- \*\*(S\d\d\.\d\d)\*\* (.+)',line)
        if m: qs.append(dict(id=m[1], question=m[2], section=current, line=n))
    scenarios=[]
    for n,line in enumerate(text.splitlines(),1):
        m=re.match(r'\| (A\d\d) \| (.+?) \| (.+?) \|$',line)
        if m: scenarios.append(dict(id=m[1], question=m[2], mapping=m[3], line=n))
    assert len(qs)==len({q['id'] for q in qs})
    return qs,sections,scenarios

def blocks(path):
    text=read(path)
    # Unrelated front matter in OLD is never imported into an answer.
    starts=list(re.finditer(r'^### (S\d\d\.\d\d)(?: — [^\n]*)?\s*$',text,re.M))
    result={}
    for i,m in enumerate(starts):
        end=starts[i+1].start() if i+1<len(starts) else len(text)
        body=text[m.end():end]
        body=re.split(r'^## (?:S\d\d|Appendix|Shared rules|Inputs and owner|Design-review cases)',body,flags=re.M)[0]
        body=re.sub(r'^\*\*Question:\*\* [^\n]*\n','',body,flags=re.M).strip()
        assert 'BARBERSHOP MANAGEMENT SYSTEM' not in body
        assert m[1] not in result, (path,m[1])
        result[m[1]]=dict(body=body,path=str(path),line=text[:m.start()].count('\n')+1)
    return result

QS,SECTIONS,SCENARIOS=canonical()
DATA=blocks(OLD)
DATA.update(blocks(DESKTOP/'S01-S02-refined-answers.md'))
DATA.update(blocks(DESKTOP/'S03-S04-proposed-answers.md'))
assert set(DATA)=={q['id'] for q in QS}, 'Source answer IDs differ from canonical questions'

# Later recorded S03 directions supersede earlier workspace/home proposals.
DATA['S02.05']['body']=DATA['S02.05']['body'].replace('A personal workspace remains available for ordinary member activity where eligible.','Permitted personal/community activity appears in the same combined home; no separate personal-home switch is required (later owner direction S03.01–S03.02).')
DATA['S02.05']['body']+='\n\n**Supersession applied:** S03.01–S03.06 control entry and home presentation. One role enters directly; several roles require an explicit role choice. Workspace here means acting capacity, never an extra personal/work home-selection step. Combining display never combines authority across parishes.'
DATA['S02.06']['body']=DATA['S02.06']['body'].replace('please note something, when the paper is printed the priests name will show not the recorded approval from the secratry, that will only show inside the system.',"**Owner clarification:** Printed sacramental paperwork identifies the responsible priest. The secretary's recording attribution appears only in authorized internal history. This does not authorize applying a signature.")

OWNER={
'S01':'Product owners/developers; head priests; bishop for religious policy',
'S02':'Product owners; competent appointing authority/bishop; head priest',
'S03':'Product owners; representative role users; head priests',
'S04':'Product owners; parish public-content owner; head priest; language reviewers',
'S05':'Head priest/public-content publisher; EN/FR/AR reviewers',
'S06':'Product/security owners; office identity reviewers; safeguarding policy owner',
'S07':'Head priest/authorized office identity reviewer; applicant',
'S08':'Head priest/office data owner; restricted-data policy owner',
'S09':'Office data owner; authorized guardian/representation reviewer',
'S10':'Office import owner; priest for official records; finance lead for balances',
'S11':'Head priest/office workflow owner; actual case assignee',
'S12':'Competent bishop and assigned parish priest; office preparation lead',
'S13':'Competent ecclesiastical authority and assigned parish priest',
'S14':'Bishop/competent document authority; signing priest; release verifier',
'S15':'Office document owner; ecclesiastical authority; privacy/security owner',
'S16':'Head priest; calendar/resource owners; approved liturgical-calendar owner',
'S17':'Priest/plan coordinator; music librarian; rights reviewer',
'S18':'Assigned ministry leader; parish priest; membership applicant',
'S19':'Assigned leader; formation approver; authorized attendance recorder',
'S20':'Volunteer coordinator; head priest; safeguarding policy owner',
'S21':'Event lead; consent reviewer; finance/refund approver',
'S22':'Event safeguarding lead; authorized check-in/pickup staff; incident reviewer',
'S23':'Resource manager; head priest/booking approver; finance lead',
'S24':'Treasurer/counting lead; independent counter; head priest',
'S25':'Head priest and designated finance lead; independent financial reviewer',
'S26':'Communications owner; head priest; privacy/security owners',
'S27':'Independent authorized concern reviewers; conflict-free safeguarding authority',
'S28':'Note author; permitted task/workflow owner; privacy owner',
'S29':'Scope-appropriate administrator/appointing authority; bishop; product owners',
'S30':'Product/design owners; EN/FR/AR reviewers; accessibility task reviewers',
'S31':'Product/security owners; office workflow owners; domain record owner',
'S32':'Product owners; records/privacy owner; ecclesiastical/finance/safeguarding approvers'}

SPEC_MAP={
'S01':['WF01','WF40'], 'S02':['WF38','WF39'], 'S03':['WF01','WF03'],
'S04':['WF05','WF06'], 'S05':['WF32'], 'S06':['WF01','WF02','WF03'],
'S07':['WF04','WF05'], 'S08':['WF06','WF07'], 'S09':['WF08'],
'S10':['WF07','WF09','WF10'], 'S11':['WF11','WF12','WF13'],
'S12':['WF14','WF15','WF16','WF17','WF18','WF19'],
'S13':['WF14','WF15','WF16','WF17','WF18','WF12'],
'S14':['WF20','WF21'], 'S15':['WF22','WF21'], 'S16':['WF23'],
'S17':['WF24','WF25'], 'S18':['WF26','WF27'], 'S19':['WF28','WF29'],
'S20':['WF30'], 'S21':['WF31','WF33'], 'S22':['WF34','WF35'],
'S23':['WF13','WF36','WF37'], 'S24':['WF41','WF42'], 'S25':['WF33','WF43','WF44','WF45'],
'S26':['WF46','WF32'], 'S27':['WF47'], 'S28':['WF48','WF49'],
'S29':['WF38','WF39','WF40'], 'S30':['WF01','WF32'], 'S31':['WF22','WF34'],
'S32':['WF50','WF40']}

KEEP={'S01.01','S01.02','S01.03','S01.04','S01.05','S01.06','S01.08','S01.09','S01.10','S01.12','S02.01','S02.04','S02.06','S02.08','S02.09','S06.10','S08.03','S09.11','S10.09','S14.12','S17.12','S19.04','S19.06','S21.07','S24.05','S25.11','S28.02'}

def source_link(d):
    p=Path(d['path'])
    if p.is_relative_to(ROOT): return f"[{p.relative_to(ROOT).as_posix()}:{d['line']}](../{p.name})" if p.parent==QFILE.parent else f"[{p.name}:{d['line']}](/{p.as_posix()}:{d['line']})"
    return f"[{p.name}:{d['line']}](/{p.as_posix()}:{d['line']})"

def generate_answers():
    supplemental=json.loads(read(OUT/'answer-refinements.json')) if (OUT/'answer-refinements.json').exists() else {}
    acceptance=json.loads(read(OUT/'acceptance-criteria.json')) if (OUT/'acceptance-criteria.json').exists() else {}
    lines=['# ParishLife — reviewed questionnaire answers', '',
    'Prepared 28 October 2026. Complete proposed answer set; human approval and runtime validation remain separate. Your supplied Desktop S01–S04 documents are incorporated question by question. Their internal Owner direction / Proposed / Input required distinctions are preserved. The current request to use them is not treated as blanket domain approval.', '',
    'Disposition describes the desired treatment; release describes scope. **Keep** preserves the stated principle, with proposed refinements identified below. **Change** specifies or revises behavior; it is not a claim that a current implementation is defective. All existing modules remain first-release design scope. Unsupported integrations remain explicitly unavailable until implemented/configured or an approved manual fallback exists.', '',
    'Detailed implementation-independent rules: [workflows](workflow-specifications.md), [permissions](permission-matrix.md), [fields](field-dictionary.md), [notifications](notification-matrix.md), [screens](navigation-and-screen-inventory.md), [documents/reports](document-and-report-specifications.md), [scenarios](scenario-walkthroughs.md), [open inputs/conflicts](open-inputs-and-conflicts.md).', '']
    last=None
    for q in QS:
        k=q['id']; s=q['section']; d=DATA[k]
        if last!=s: lines += [f"## {s} — {SECTIONS[s]}",'']; last=s
        body=d['body']
        status='Recorded owner direction plus proposed detail' if '**Owner direction:**' in body or '**Owner clarification:**' in body or '**Owner response:**' in body else 'Proposed recommendation'
        if '**Input required' in body or 'input required' in body.lower(): status+='; factual input required'
        disposition='Keep' if k in KEEP else 'Change'
        workflows=SPEC_MAP[s]
        links=', '.join(f'[{w}](workflow-specifications.md#{w.lower()})' for w in workflows)
        related_scenarios=[a['id'] for a in SCENARIOS if s in a['mapping']]
        scenarios=', '.join(f'[{a}](scenario-walkthroughs.md#{a.lower()})' for a in related_scenarios)
        criterion=acceptance.get(k, f"Apply the stated decision to its mapped workflow/screen and verify its visible result, audience and exception path against the linked specification. The section-specific review in the decision register remains required.")
        lines += [f'### {k}', '', f"**Question:** {q['question']}", '',
        f"**Disposition:** {disposition} — {'preserve the explicit principle and apply the detailed rules below' if disposition=='Keep' else 'adopt the explicit behavior below, with new details proposed for review'}. **Release:** First release (retained module/design scope).", '',
        f"**Authority/evidence:** {status}. Source: {source_link(d)}. Canonical question: [questionnaire](../questionnaire.md). New specification material is proposed unless explicitly identified as a recorded owner direction.", '',body,'']
        if k in supplemental: lines += ['**Reviewed completion:** '+supplemental[k], '']
        lines += [f"**Owner / operational approval:** {OWNER[s]}. Individual names have not been supplied; role ownership is not a fabricated personal sign-off. See [input register](open-inputs-and-conflicts.md) for required evidence and milestones.", '',f"**Dependencies / detailed behavior:** {links}; [permission matrix](permission-matrix.md); [section decision](decision-register.md#{s.lower()})."+(f' Scenario references: {scenarios}.' if scenarios else ''),'',f'**Acceptance:** {criterion}', '']
    write('answers.md','\n'.join(lines))

def main():
    baseline=OUT/'source-manifest.json'
    if not baseline.exists(): write('source-manifest.json',json.dumps({str(p):sha(p) for p in SOURCES},ensure_ascii=False,indent=2))
    write('question-inventory.json',json.dumps(dict(questions=QS,sections=SECTIONS,scenarios=SCENARIOS),ensure_ascii=False,indent=2))
    generate_answers()
    print(json.dumps({'questions':len(QS),'sections':len(SECTIONS),'scenarios':len(SCENARIOS),'answers_written':str(OUT/'answers.md')},indent=2))

if __name__=='__main__': main()
