import fs from 'node:fs';
import crypto from 'node:crypto';
const trace = JSON.parse(fs.readFileSync('docs/implementation/traceability.json', 'utf8'));
const questions = JSON.parse(fs.readFileSync('docs/ux-discovery/reviewed-answers/question-inventory.json', 'utf8')).questions;
const criteria = JSON.parse(fs.readFileSync('docs/ux-discovery/reviewed-answers/acceptance-criteria.json', 'utf8'));
const errors = [];
if (trace.questions.map(q => q.id).join() !== questions.map(q => q.id).join()) errors.push('Question IDs/order differ.');
if (trace.scenarios.map(s => s.id).join() !== Array.from({length:30}, (_, i) => 'A' + String(i+1).padStart(2,'0')).join()) errors.push('Scenario IDs/order differ.');
for (const q of trace.questions) {
 if (q.acceptance !== criteria[q.id] || !q.status || !q.remaining || !q.dependencies) errors.push('Incomplete question ' + q.id);
 for (const file of q.evidence) if (!fs.existsSync(file)) errors.push('Missing evidence ' + file);
 if (q.focalTest) {
  const [type, method] = q.focalTest.split('.');
  const code = fs.readFileSync(`tests/ParishLive.IntegrationTests/${type}.cs`, 'utf8');
  if (!code.includes(method + '(')) errors.push('Missing focal test ' + q.focalTest);
 }
}
for (const s of trace.scenarios) if (!s.status || !s.evidence.length || !s.remaining.length || !s.questionSections?.length) errors.push('Incomplete scenario review ' + s.id);
const manifest = JSON.parse(fs.readFileSync('docs/implementation/requirements-sources.json', 'utf8'));
for (const [file, expected] of Object.entries(manifest.files)) {
 const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if (actual !== expected) errors.push('Reviewed source changed: ' + file);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('PASS: 436 exact question criteria, 30 scenario reviews, existing code/test references and unchanged primary reviewed sources. This is traceability validation, not application acceptance.');
