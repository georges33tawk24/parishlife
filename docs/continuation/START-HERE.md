# Moving ParishLife continuation to Claude

> Historical optional Claude setup guide. The owner currently continues implementation here on `dev/colin/backend-reliability-20261110`; use [STATUS.md](STATUS.md) and the [latest verification](../verification/backend-2026-11-10-reliability.md) for current commits, tests and next work. Branch/count/setup observations below describe the earlier handover.

Prepared **10 November 2026**. The backend was pulled from Georges's repository and reviewed. All existing work was preserved. The current local continuation also includes a verified MFA race fix and this handover; those additions have not been pushed.

## Recommended setup

Use **Claude Code with this local checkout** so the assistant can inspect/edit files and run the actual .NET build/tests. Claude Code supports terminal/IDE/desktop/browser coding environments; a GitHub attachment in an ordinary chat supplies context, which is different from establishing an editable checkout with shell/test tools. Verify the selected environment has those tools. [Official Claude Code overview](https://code.claude.com/docs/en/overview), [GitHub context integration](https://support.claude.com/en/articles/10167454-use-the-github-integration).

On this machine the `claude` executable was not found on PATH during the handover check. If needed, install using Anthropic's official instructions; no application was installed by this task. In an existing Claude Code/IDE setup, simply select the local folder.

```powershell
Set-Location 'C:\Users\User\source\repos\ParishLife'
git status --short
git branch --show-current
claude
```

The expected branch is `dev/colin/claude-handover-20261110`. Do not switch away or reset it without inspecting its local commits. The local `backend` reference remains the pulled `a4cb405` baseline; `dev/colin-following` preserves earlier WIP.

## Give Claude the context once

1. Keep root `CLAUDE.md` and `AGENTS.md` in the checkout. The prepared CLAUDE file imports AGENTS explicitly and points to the current state. [Anthropic documents persistent instructions/imports here](https://code.claude.com/docs/en/memory).
2. Paste the complete [MASTER-PROMPT.md](MASTER-PROMPT.md) into the first Claude Code session, or ask it to read that actual local file and apply it as your working brief.
3. Ensure the original/reviewed requirements in [SOURCES.md](SOURCES.md) are accessible. This local machine has them. On another machine, provide actual originals/the earlier sanitized documentation archive, then the current handover; never supply credentials.
4. Start with: **Read CLAUDE.md and docs/continuation/STATUS.md, then continue working under docs/continuation/MASTER-PROMPT.md. Begin with the first unresolved priority, implement and test it, update the checkpoint, and proceed with unblocked work.**

Afterward, **continue** is enough in that established session. The saved files define what to resume even when earlier conversation text is unavailable. They must be updated after real work rather than used as a permanent stale snapshot.

When returning to an existing local Claude Code session:

```powershell
claude --continue
```

This resumes the most recent session in the current directory; `claude --resume` lets you select a previous one. This command is distinct from the ordinary message **continue**, which the master prompt defines as the backend work instruction. [Official session continuation guidance](https://code.claude.com/docs/en/common-workflows#resume-previous-conversations).

A prompt cannot override usage/context/tool limits or grant unavailable repository access. The durable status/master brief makes resumption reliable; it does not promise a permanently running agent or guarantee bug-free completion.

## For a different machine or remote coding workspace

Clone the **backend branch** from `https://github.com/georges33tawk24/parishlife.git`, not its default branch by assumption. A fresh clone includes `a4cb405` or later remote developments, but does not include this local branch's fix/documents until they are explicitly shared. Do not claim the local 279-pass result applies to an unpatched remote clone. Import/review the local continuation or reproduce its documented fix; verify the current state again before continuing.

Maintain separate development branches for Colin and Georges. Verify remote URLs because this local checkout's `origin` points to Colin and `upstream` to Georges. Do not force-push or silently publish to the wrong repository. No remote push was performed during this pull/review/handover task.

## What to check

- [STATUS.md](STATUS.md): current branch, local fix, fresh tests, blockers and next task.
- [REVIEW-2026-11-10.md](REVIEW-2026-11-10.md): what changed and which source findings remain.
- [CARDS-2026-11-10.md](CARDS-2026-11-10.md): full 149-card snapshot; zero fully accepted, 124 partial, 25 not started.
- Canonical `docs/features/coverage.json`: update this with real future implementation/evidence; do not count partial cards as finished.
