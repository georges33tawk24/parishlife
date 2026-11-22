#!/bin/sh
# Purpose: checks .githooks/commit-msg accepts messages that say what and why, and refuses vague or unexplained ones.
# Main function: expect <pass|fail> <message>; exits 1 if any case is judged wrongly. Run from the repository root:
#   sh tools/tests/commit-msg.Tests.sh      (CI runs it in the "Commit messages" job)

hook="$(dirname "$0")/../../.githooks/commit-msg"
work=$(mktemp)
trap 'rm -f "$work"' EXIT
failures=0

expect() {
  printf '%b' "$2" > "$work"
  if sh "$hook" "$work" 2>/dev/null; then got=pass; else got=fail; fi
  if [ "$got" != "$1" ]; then
    echo "WRONG: expected $1, got $got for: $(printf '%b' "$2" | head -n 1)"
    failures=$((failures + 1))
  fi
}

expect pass 'CI: run the backend tests on every push\n\nNothing ran the 591 tests before a deploy.\n'
expect pass 'CI: run the backend tests on every push\n\nNothing ran them.\n\nCo-Authored-By: Someone <a@b.c>\n'
expect pass 'Merge branch fullstack-hardening'
expect pass 'Revert "CI: run the backend tests"\n'
expect pass 'fixup! CI: run the backend tests'
expect pass '# a comment git strips\nCI: run the backend tests on every push\n\nWhy: nothing ran them.\n# another\n'
expect fail 'CI: run the backend tests on every push\n\n# ------------------------ >8 ------------------------\ndiff --git a/x b/x\n+added\n'
expect fail 'fix'
expect fail 'Fix.\n\nSomething was broken.\n'
expect fail 'minor changes\n\nSome reason.\n'
expect fail 'CI: run the backend tests on every push'
expect fail 'CI: run the backend tests on every push\n\nCo-Authored-By: Someone <a@b.c>\n'
expect fail 'CI: run the backend tests on every push\nno blank line before the reason\n'
expect fail 'CI: run the backend tests on every push, the frontend checks, the audit and the scan\n\nToo long.\n'

if [ "$failures" -ne 0 ]; then
  echo "commit-msg tests: $failures wrong"
  exit 1
fi
echo "commit-msg tests: all 14 cases passed"
