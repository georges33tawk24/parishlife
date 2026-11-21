# Multi-agent hardening: run guide

This folder holds 10 prompts. Each prompt goes to its own, separate Claude Opus 5.5 session in Claude Code, opened in your project. No agent does another agent's work. Do not start any of them until your front-end work is finished and merged into your main branch (the two exceptions are marked "can run early" below).

## The agents

| File | Agent | Edits code? |
|---|---|---|
| 01-recon.md | Recon & architecture map | No (writes only the hardening/ map files) |
| 02-secrets-dependencies.md | Secrets & dependencies | Yes |
| 03-app-security-auth.md | Application security & authentication | Yes |
| 04-performance.md | Performance | Yes |
| 05-ui-design-accessibility.md | UI, design & accessibility | Yes |
| 06-legal-privacy-content.md | Legal, privacy, content & SEO/AEO | Yes |
| 07-ai-llm.md | AI/LLM safety & reliability (only if your app uses a model) | Yes |
| 08-devops-sre.md | DevOps, infrastructure & monitoring | Yes (config and pipelines) |
| 09-qa.md | QA & testing | Tests only, never app code |
| 10-auditor.md | Independent auditor & final report | No (writes only the final report) |

## Added items

On 21 November 2026 the owner's six checklists (normal users breaking the app, huge bills, Google visibility, signs of vibe coding, lawsuits, and app feel) were compared with these prompts. Items already covered were left as they were; missing ones were added to the owning agent (03 Part C, 05 Part C, and new numbered items in 01, 02, 04, 06, 07, 08 and 09) and to the auditor's master checklist. `00-CHECKLIST-COVERAGE.md` maps every checklist item to the prompt item that covers it.

## One-time setup (before any agent)

1. Fill in `00-PROJECT_CONTEXT-template.md`.
2. In your repository, create a folder `hardening/` with:
   - `hardening/PROJECT_CONTEXT.md` (the filled-in template)
   - `hardening/handoffs/` (empty folder; add a `.gitkeep` file)
   - `hardening/reports/` (empty folder; add a `.gitkeep` file)
3. Commit that to your main branch.

## Shared files the agents use

- `hardening/PROJECT_CONTEXT.md`: your business and product details (you write it).
- `hardening/PROJECT_MAP.md`: the codebase map, applicability list and file ownership table (agent 01 writes it).
- `hardening/handoffs/from-NN-name.md`: each agent's requests to other agents. One file per agent, so they never conflict.
- `hardening/reports/NN-name.md`: each agent's report. The auditor merges them into `hardening/FINAL-REPORT.md`.

## Order of work (waves)

Each agent works on its own branch named `hardening/NN-name`, in its own git worktree (in Claude Code, start the session with a worktree, or ask it to create one). Agents in the same wave can run at the same time. Merge a whole wave into main, in the order shown, before starting the next wave.

| Wave | Agents (run in parallel) | Merge order |
|---|---|---|
| Can run early, even before the front-end is done | 02 Part A only (git history secret scan + key rotation steps); 06 Part A only (draft legal text into hardening/legal-drafts/) | 06 Part A merges with wave 2; 02 Part A changes no code |
| Wave 0 | 01 Recon | 01 |
| Wave 1 | 02 Part B, 03, 07 | 02 → 03 → 07 |
| Wave 2 | 04, 06 Part B | 04 → 06 |
| Wave 3 | 05 | 05 |
| Wave 4 | 08, 09 | 08 → 09 |
| Wave 5 | 10 Auditor | 10 |

Why this order:
- Recon first, so nobody re-maps the codebase differently.
- Security before performance, because both edit API handlers and queries.
- UI, design and accessibility after legal and performance, so it styles and checks the final versions of every page, including the new policy pages, cookie banner and error states.
- DevOps and QA after the app code is final; the auditor last, on finished work.

## Handoff sweep (after each wave is merged)

Agents write requests for other agents into `hardening/handoffs/`. Agents in later waves read them automatically when they start. Requests addressed to an agent that has already run need a sweep. After merging a wave, send this message to each earlier agent that has requests waiting (in its existing session):

> Read every file in hardening/handoffs/ on the main branch. Handle each request addressed to you that is not yet marked handled, on a new branch hardening/NN-name-sweep-WAVE. Mark each handled request with "HANDLED: <what you did>" in your own report, not in the other agent's file. Follow all your original rules. Update your report.

## Expected merge conflict hotspots

When merging, the later branch keeps both sides unless they truly contradict:
- Package manifest and lockfile: keep all additions; regenerate the lockfile with your package manager's install command.
- Database schema file: keep all additions from both branches.
- `.env.example`: keep all variable names from both branches.
- Image tags: agent 04 sets loading/size/format attributes; agent 05 sets alt text. Keep both.

## Model and effort

Use Claude Opus 5.5 for every agent. Use high effort for 03 (security), 02 (secrets) and 10 (auditor). The others can use your normal effort.

## When it's done

Read `hardening/FINAL-REPORT.md`. Its "Needs your action" section lists everything only you can do: revoking and rotating keys, billing caps, DNS records (SPF/DKIM/DMARC), domain/SSL, monitoring accounts, confirming fake reviews, filling in business details, and lawyer review of the legal documents.
