import fs from 'node:fs';
const file = 'docs/implementation/traceability.json';
const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
const coverage = JSON.parse(fs.readFileSync('docs/implementation/coverage-map.json', 'utf8'));
const scenarioText = fs.readFileSync('docs/ux-discovery/reviewed-answers/scenario-walkthroughs.md', 'utf8').replaceAll('\r\n','\n');
for (const scenario of trace.scenarios) {
 const chunk = scenarioText.split('## ' + scenario.id + '\n')[1]?.split('\n## A')[0] ?? '';
 const mapping = chunk.match(/\*\*Canonical question mapping:\*\* ([^\n]+)/)?.[1] ?? '';
 const sections = new Set([...mapping.matchAll(/S(\d\d)/g)].map(m => 'S' + m[1]));
 for (const range of mapping.matchAll(/S(\d\d)[–-]S(\d\d)/g))
  for (let n = Number(range[1]); n <= Number(range[2]); n++) sections.add('S' + String(n).padStart(2, '0'));
 if (!sections.size) throw new Error('Missing source section mapping for ' + scenario.id);
 scenario.questionSections = [...sections].sort();
}
const focal = {
 'S02.07':'ReviewedRequirementsTests.Secretary_records_genuine_prior_instruction_effectively_once_with_both_identities',
 'S05.03':'ReviewedRequirementsTests.Missing_translation_and_stale_draft_do_not_unpublish_live_revision',
 'S05.05':'ReviewedRequirementsTests.Missing_translation_and_stale_draft_do_not_unpublish_live_revision',
 'S11.03':'AccessAndRecoveryTests.Unlinked_applicant_can_resume_own_draft_and_replace_rejected_evidence_without_other_case_access',
 'S11.14':'AccessAndRecoveryTests.Guest_retry_association_and_revocation_preserve_one_original_request_without_membership',
 'S12.02':'ReviewedRequirementsTests.Priest_direct_acceptance_does_not_fabricate_office_review_or_verify_missing_evidence',
 'S14.06':'AccessAndRecoveryTests.Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn',
 'S15.11':'AccessAndRecoveryTests.Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn',
 'S21.05':'ConcurrentAdmissionTests.Independent_connections_competing_for_the_final_place_cannot_overbook',
 'S22.08':'AccessAndRecoveryTests.Unknown_age_blocks_confirmation_and_unauthorized_collector_never_creates_an_exit',
 'S24.07':'ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once',
 'S24.08':'ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once',
 'S24.09':'ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once',
 'S25.11':'ReviewedRequirementsTests.Office_allowance_transfer_is_not_an_expense_and_original_currency_is_preserved',
 'S25.16':'AccessAndRecoveryTests.Financial_viewer_export_is_scope_limited_and_escapes_spreadsheet_formulas',
 'S27.07':'AccessAndRecoveryTests.Anonymous_sensitive_concern_has_no_admin_count_and_confidential_identity_requires_separate_grant',
 'S31.09':'ReviewedRequirementsTests.Reusing_operation_id_with_a_changed_payload_is_refused'
};
trace.implementationComplete = false;
trace.statusMeaning = 'Focal automated checks verify the named boundary only. No full question or A scenario is certified complete. Storage-only entities are not implemented workflows. Missing software is separate from U01–U15 real-world inputs.';
for (const q of trace.questions) {
 const section = q.id.split('.')[0], item = coverage.sections[section];
 if (!item) throw new Error('Missing section ' + section);
 q.status = ['S17','S19','S20'].includes(section) ? 'workflow not implemented' : focal[q.id] ? 'focal boundary tested; complete question open' : 'incomplete / full criterion not verified';
 q.evidence = item.paths;
 q.focalTest = focal[q.id] ?? null;
 q.remaining = item.remaining;
 q.dependencies = item.dependencies;
 q.scenarios = trace.scenarios.filter(s => s.questionSections.includes(section)).map(s => s.id);
}
for (const s of trace.scenarios) {
 const item = coverage.scenarios[s.id]; if (!item) throw new Error('Missing scenario ' + s.id);
 s.status = ['A13','A19','A26'].includes(s.id) ? 'not implemented / not executed' : 'partial checks only; full acceptance open';
 s.evidence = [item.tested]; s.remaining = [item.remaining, 'Named real-world/domain review and U14 acceptance are unperformed.'];
}
if (trace.questions.length !== 436 || trace.scenarios.length !== 30 || new Set(trace.questions.map(q => q.id)).size !== 436) throw new Error('Coverage inventory mismatch');
fs.writeFileSync(file, JSON.stringify(trace, null, 2) + '\n');
const link = p => `[${p}](../../${p})`;
let checklist = '# Implementation checklist\n\nBaseline: `' + trace.baseline + '` from `origin/main`; branch `codex/reviewed-requirements`.\n\n**Incomplete.** This checklist accounts for all 436 questions and all 30 acceptance scenarios. A checked focal test is not completion of its entire question. The reviewed source pack and its historical passing checks do not establish application correctness. [Verification](verification.md) and [scenario review](scenario-review.md) define the actual evidence and limits.\n\n';
for (const [section, item] of Object.entries(coverage.sections)) {
 checklist += `## ${section}\n\nImplemented portion: ${item.implemented}\n\nCode: ${item.paths.length ? item.paths.map(link).join(', ') : 'No workflow implementation.'}\n\nRemaining software: ${item.remaining}\n\nReal-world inputs: ${item.dependencies.join(', ')} — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).\n\n`;
 for (const q of trace.questions.filter(q => q.id.startsWith(section + '.'))) {
  checklist += `- [ ] **${q.id}** — ${q.acceptance} (${q.workflows.join(', ')}; ${q.status}).\n`;
  if (q.focalTest) checklist += `  Focal evidence: \`${q.focalTest}\`.\n`;
 }
 checklist += '\n';
}
fs.writeFileSync('docs/implementation/checklist.md', checklist.trimEnd() + '\n');
let scenarios = '# Review of all 30 acceptance scenarios\n\n**No complete A01–A30 scenario is certified passed.** Tests exercise specific software paths. Actual domain approvals, named users, signatures, safeguarding procedures, translations and physical printing remain separate. Software gaps below are implementation work, not external-service dependencies. [Source scenarios](../ux-discovery/reviewed-answers/scenario-walkthroughs.md).\n\n';
for (const s of trace.scenarios) {
 const item = coverage.scenarios[s.id];
 scenarios += `## ${s.id}\n\n${s.scenario}\n\nStatus: **${s.status}**.\n\nChecked: ${item.tested}\n\nStill required: ${item.remaining}\n\nMapped workflows: ${s.workflows.join(', ')}. Actual domain and representative-user validation remains U14.\n\n`;
}
fs.writeFileSync('docs/implementation/scenario-review.md', scenarios.trimEnd() + '\n');
console.log('Updated traceable inventory: 436 questions, 32 sections, 30 scenarios; full implementation remains incomplete.');
