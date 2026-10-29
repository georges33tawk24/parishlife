from build_pack import *
from render_specs import table

def main():
    full=read(OUT/'answers.md')
    # Readable per-section copies; answers.md remains the canonical complete set.
    matches=list(re.finditer(r'^## (S\d\d) — ([^\n]+)$',full,re.M))
    for i,m in enumerate(matches):
        end=matches[i+1].start() if i+1<len(matches) else len(full)
        body=full[m.start():end]
        def shift(x):
            target=x[1]
            if target.startswith(('/', 'http://','https://','#')) or re.match(r'^[A-Za-z]:',target):return ']('+target+')'
            return '](../'+target+')'
        body=re.sub(r'\]\(([^)\n]+)\)',shift,body)
        write('sections/'+m[1]+'.md',f'# {m[1]} — section answer copy\n\n[Reading index](../README.md) · [Complete canonical answers](../answers.md)\n\nRecorded owner directions and proposed additions retain their separate status. See the full pack for linked detailed specifications and open approval inputs.\n\n'+body)
    index=[('# ParishLife — complete reviewed answer pack'),'',
    'Prepared 28 October 2026. **All 436 canonical questions across S01–S32 have direct answers; all 30 A scenarios have separate walkthroughs.** Your two Desktop S01–S04 answer files are incorporated question by question, preserving their recorded owner-direction/proposed/input distinctions. Later S03 combined-home directions and printed-priest-name clarification are applied consistently.', '',
    'Start with [the complete answers](answers.md), or open one section below. This is a detailed proposed product/UX specification. It does not claim that policy owners have approved new recommendations, translations are professionally reviewed, the prototype has been tested, or the application already implements the proposals.', '',
    '## Questions by section','',table(['Section','Questions','Subject'],[(f'[{s}](sections/{s}.md)',str(sum(q['section']==s for q in QS)),title) for s,title in SECTIONS.items()]),'',
    '## Supporting deliverables','',table(['File','Purpose'],[
    ('[Decision register](decision-register.md)','Recorded directions, per-section ownership, dependencies and change control'),
    ('[65 workflow cards](workflow-specifications.md)','Ten required card rows plus explicit normal/return/cancel/reopen transition tables and acceptance paths'),
    ('[Permission matrix](permission-matrix.md)','Per-record actions, scoped roles, priest-instruction/signature/release distinctions, independent finance/case access'),
    ('[Field dictionary](field-dictionary.md)','389 definitions, EN/AR/FR labels and resolved error copy; 878 bindings across 65 forms with required/conditional, source, validation, privacy/locking/output/audit rules'),
    ('[Notification matrix](notification-matrix.md)','Every defined transition, deliberate no-send rules, exact proposed EN/FR/AR message catalog, timing/channel/privacy/failure rules'),
    ('[Navigation and 38 screens](navigation-and-screen-inventory.md)','Combined Home, role entry/navigation, page/drawer choices, responsive/accessibility/language and state annotations'),
    ('[Documents, reports and money examples](document-and-report-specifications.md)','Official-output requirements, 15 metric definitions and worked fictional no-double-counting examples'),
    ('[30 scenario walkthroughs](scenario-walkthroughs.md)','Actors/screens/steps/messages/data/audit/recovery and expected end conditions for every A01–A30 scenario'),
    ('[Open inputs, conflicts and defaults](open-inputs-and-conflicts.md)','15 real-input/approval groups, source conflicts/supersession and concrete interim behaviors/milestones'),
    ('[Coverage and quality report](coverage-and-quality-report.md)','Reproducible checks, editorial review findings and every questionnaire completion-gate status')]),'',
    '## What is confirmed, proposed and still needed','',
    'Recorded owner directions remain distinguishable from new detail: initial Beirut/two-parish setting, all existing modules, three priorities and languages, optional secretaries, individual scoped roles, priest decisions with effective case-specific secretary recording, priest name on official print, one combined Home/explicit multirole choice and combined authorized parish view. Proposed detail does not become Agreed merely by appearing here.', '',
    'Actual ecclesiastical requirements/numbering, official specimen wording/signatures/bishop policy, real names/contacts/schedules, financial terms and opening data, guardian/safeguarding/independent concern routing, retention rules and named validation reviewers must be supplied by their competent owners. U01–U15 state exactly what is needed, who owns it, when it matters and the safe interim behavior. These are factual limits, not skipped questions.', '',
    'The unrelated barbershop instructions in the earlier consolidated draft were excluded. The original questionnaire, both supplied Desktop files and previous drafts/register/prompt remain unchanged; source-manifest.json records hashes. No application code, account, database, deployment or Git setting was changed by this work.', '',
    '## Verification and reproducibility','',
    'Run the bundled Python interpreter (or another suitable Python 3) against `check_pack.py` in this directory. It checks exact IDs/order/question wording, scenario wording/mapping, required metadata, specific acceptance criteria, all workflow/form/transition bindings, local Markdown links/anchors and preserved original hashes. [Machine-readable results](check-results.json). These checks establish documentation integrity; they cannot prove human policy approval, runtime correctness or usability.', '',
    'Authoring/rebuild order: `build_pack.py`, `render_specs.py`, `render_fields.py`, `render_governance.py`, `render_experience.py`, `scenario_data.py`, `review_completions.py`, `finalize_pack.py`, then `check_pack.py`. Inputs/data are contained in the adjacent authoring modules and JSON inventories. The final review_completions step applies deliberate supersession/refinements after source consolidation; do not rebuild only build_pack.py and omit it.', '',
    'No interactive prototype or live operational validation was performed. Next human review should prioritize U04 priest-instruction stage scope, U05 certificates, U06 financial controls and U07 safeguarding/independent routing, then qualified EN/FR/AR and representative-user validation. Developers retain recorded final product/design release authority.' ]
    write('README.md','\n'.join(index))
    gates=[
    ('Owner, scope and first-use/unavailable behavior for every retained module','Specified in answers, section register, 65 cards and screen inventory; actual named appointees/approvals still U01/U14','Documentation supplied; human scope/domain acceptance outstanding'),
    ('Allowed actor/scope, prerequisite, state, audience and correction/cancel for each action','Workflow transitions and P01–P29 matrix; official/financial terminal correction separated','Documentation supplied; U02/U04/U05/U06/U07 approval; implementation unverified'),
    ('Approved bilingual field dictionary/validation/privacy','389 EN/AR/FR labels and actual error copy; 878 explicit form bindings with shared normative type/privacy profiles','Proposed dictionary supplied; professional language/domain approval U14 and actual UI comparison outstanding'),
    ('Applicant/staff timeline and real notifications','Per-transition rows and M01–M10 full proposed language text; in-app/manual/real-provider/scheduler distinctions','Specified; actual delivery/verification/MFA/worker readiness U10 outstanding'),
    ('Defined metric/event supporting every displayed claim','MT01–MT15 with units/periods/statuses/currency/unknowns; static sample success excluded','Definitions supplied; actual screen-data implementation and source completeness unverified'),
    ('Annotated critical screens for normal/loading/empty/denied/conflict/offline/failure','38 named screens plus shared state contract and 30 concrete textual walkthroughs','Text annotations supplied; interactive prototypes/actual renders/assistive validation outstanding U14'),
    ('Approved document/export language/authority/release/version behavior','Output inventory, exact release checks, original priest-name print rule and immutable version/correction policy','Specified; real official specimens/validity/policy U05 and printed prototypes outstanding'),
    ('Representative users perform and approve scenarios/prototype','Every A01–A30 has data/actors/screens/steps/messages/recovery/evidence/criteria','Not performed; actual named reviewers, results and sign-offs required U14'),
    ('Unanswered decisions resolved or deferred with owner/fallback','All canonical questions have direct proposed answer; U01–U15 carry required factual evidence/role/milestone/fallback/launch effect','No fabricated dates/approvals; owners must set actual dates before recording agreed deferral')]
    report=['# Coverage and quality report','',
    '**Documentation status:** Complete canonical answer draft and supporting proposed specification pack. **Operational/design approval status:** Open pending listed real inputs, qualified translations and actual prototype/domain validation. No implementation, release-readiness or completion-percentage claim is made.', '',
    '## Reproducible structural checks','',
    'Command used in this workspace:', '',
    '```powershell',
    "& 'C:\\Users\\User\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe' 'docs\\ux-discovery\\reviewed-answers\\check_pack.py'",
    '```','',
    'Actual pass/fail, counts, local-link findings and individual assertions are recorded in [check-results.json](check-results.json). Rerun after any change; this report does not hard-code a successful check. The checker reads original documents and generated files, writes its own result only, and imports no application code or database.', '',
    'Expected canonical coverage: 436 unique questions in original order/wording and 32 sections; 30 exact scenarios. Proposed detailed inventory: 65 ten-row workflow cards, 65 forms with 878 explicit bindings/389 definitions, per-transition notification rows, P01–P29 action matrix, 38 named screens and MT01–MT15 definitions. Individual question acceptance criteria are authored for all 436 IDs.', '',
    '## Editorial review and corrections','',
    table(['Finding checked','Review outcome / correction','Residual limit'],[
    ('S01–S04 incorporation and source status','Both supplied Desktop files used by canonical ID; explicit owner/proposed/input status preserved; S03.07 visibly completed as recommendation','Current request is not invented clergy/finance/template approval'),
    ('Unrelated original draft contamination','Two unrelated barbershop blocks excluded before ParishLife question extraction; no command/role/stack propagated','Original intentionally preserved for provenance; input report identifies it'),
    ('Home/role supersession','Old personal-workspace clause corrected using later S03 single combined Home and deliberate multiple-role entry','Exact chosen-capacity enforcement remains explicit proposed interpretation'),
    ('Proxy approval versus priest signature/print','Effective prior case instruction recording preserved, both identities internal, printed priest authority only; no duplicate online reapproval','U04 exact permissible stages/disputes and U05 personal signature/bishop policy require domain approval'),
    ('Certificate state/release','Signed, bishop accepted, issued, reviewed file released and collected are distinct; legacy unknown metadata not fabricated','Current code uses older issued vocabulary; desired mapping requires future implementation'),
    ('Guest leaked-link boundary','Current bearer-token download source behavior explicitly distinguished from proposed fresh authenticated/verified check','No claim source vulnerability was fixed; manual collection/reviewed account route until implementation'),
    ('Child consent/capacity/pickup','Reserved/Confirmed/payment/transport/arrival/collector authority separate; concurrent final seat and offline paper reconciliation fully walked through','Actual safeguarding lead/procedure and age/consent policy U03/U07 required; no invented emergency advice'),
    ('Financial reconciliation','Actual original currencies, canonical movement/allocations, independent count and post-close correction; numerical giving/event/office-transfer cases supplied','Ledger authority/terms/actual balances and rounding policy need U06; no tax/legal certification'),
    ('Permission leaks','Private concerns/notes/incidents/absence/medical/donor facts separated from general counters/search/export/print; revocation includes open tabs','Source/runtime/backend parity not exhaustively tested; implementation must validate matrix'),
    ('Default precision and actual capability','Deadlines/file limits/quiet windows/password/session/undo defaults explicitly proposed/effective-versioned; fake provider/worker/billing/offline success excluded','Actual delivery/security/performance configuration U10/U11 remains outside documentation verification'),
    ('Password and old appendices','Older 12-character proposal superseded by reviewed 16–200; actual Appendix B/C/D references replaced with existing pack destinations','Legacy credential migration/security owner approval still required'),
    ('Language/error breadth','Every master field label and resolved validation error has EN/FR/AR draft wording; notification subjects/bodies and mixed-direction rules supplied','Qualified translation/official terminology review U14; no claim human bilingual/trilingual certification'),
    ('Unapproved or impossible facts','No invented statutory retention, sacramental doctrine, official identity/template, exchange quote, fee, named approver or measured test result','U01–U15 explicitly capture required evidence and launch fallback'),
    ('Coverage versus substantive quality','Every question has direct prose plus specific criterion; scenarios exercise each original complication, supporting forms/actions are enumerated','Structural passing cannot prove there are zero semantic errors; competent review/prototype execution still required')]),'',
    '## Questionnaire completion gate','',table(['Original gate','Evidence supplied','Truthful current status'],gates),'',
    '## Preserved sources and work boundaries','',
    'source-manifest.json captures seven original source hashes: canonical questionnaire, earlier complete draft, original decision register/refined source, both supplied Desktop answer files and invoked answering prompt. The checker compares them after authoring. All new writes are within this reviewed-answers directory. No application tests, account/data mutations, production activity, deployment or Git configuration changes were performed.', '',
    '## External primary references','',
    'Accessibility design target derives from [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/); password guidance context from [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html). Their application as product targets is explicitly proposed; neither source establishes Lebanese legal duties, local church policy or actual implementation compliance. Summaries are limited to the specific verified design points, with no copied standards text.', '',
    '## Final review boundary','',
    'The answers/specifications are delivered for review. Remaining human factual/approval work is explicitly assigned by role and milestone. Prototype build, actual user testing, implementation feasibility/security/performance checks and live operational sign-off remain future evidence; documentation completion alone does not close these gates.' ]
    result_path=OUT/'check-results.json'
    if result_path.exists():
        result=json.loads(read(result_path))
        summary=['## Latest executed check result','', '**'+result['status']+'** — documentation checker executed in this workspace after authoring. Counts below come from actual parsed outputs, not a projected checklist.', '', table(['Measure','Actual count'],result['counts'].items()), '', 'All individual assertions and exact scope limits are retained in [machine-readable results](check-results.json). A pass verifies structural consistency and checked invariants; it is not a claim of zero semantic errors or human/operational approval.', '']
        report[4:4]=summary
    write('coverage-and-quality-report.md','\n'.join(report))
    print('Reading index, 32 section copies and completion-gate/editorial report written.')

if __name__=='__main__':main()
