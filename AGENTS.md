# AI agent instructions — healthentry

Follow repository documentation and existing release/security requirements.

## AI agent execution efficiency (shared policy)

- Reuse installed dependencies, lockfiles, and caches. Do not run `npm ci` or reinstall packages by default; first check whether dependencies are present and whether the lockfile changed.
- If an installation shows no meaningful progress for 3 minutes, stop it and report the blocker. Use a bounded command timeout; do not leave unattended background installs. A warning alone is not an error.
- Prefer focused tests for the files changed. Reuse prior test evidence only when the tested commit, relevant files, dependencies, and environment remain unchanged; otherwise rerun the affected checks. Run the full suite when the change scope or release gate requires it.
- Do not start Android/iOS builds, simulators, emulators, or native preflight for docs-only changes. For native changes, perform required native verification before claiming readiness; if unavailable, mark it blocked, not passed.
- Give expensive commands an explicit time budget. Stop and summarize when the budget is exceeded instead of polling indefinitely. Limit repetitive debugging retries to two before recording a blocker or changing approach.
- One feature = one PR. Update existing PRs rather than stacking new PRs. Review existing open PRs before creating new work; merge verified changes promptly when permitted, then clean up only proven-redundant branches.
- Do not run, dispatch, re-enable, or deliberately trigger GitHub Actions while billing restrictions remain. Never bypass enforced required checks, reviews, or branch protection. An unavailable plan-gated protection/ruleset API is not proof of an active merge block: inspect effective branch protection, PR mergeability, and actual merge API errors.
- Never claim unrun tests passed, or emulator results as physical-device testing. No paid APIs, secrets, production deployment, or store submission without explicit authorization.
- Prefer a concise handoff: changed files, tests actually run, commit/PR SHA, remaining blockers, and next step.
