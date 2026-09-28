---
name: copilot-pr-code-review
description: Manages the GitHub Copilot code-review lifecycle for pull requests, including review requests, re-reviews after pushes, authentication recovery, and feedback triage. Use when creating or updating a PR that is ready for review, requesting Copilot review, or handling Copilot review comments.
---

# Copilot Code Review

Keep every ready pull request under current Copilot review.

## Request Or Re-request Review

1. Confirm the pull request is ready for review, not draft.
2. Request review after creating the PR and re-request it after every subsequent
   push:

   ```bash
   gh pr edit <number> --add-reviewer @copilot
   ```

   Omit `<number>` when the current branch identifies the PR.

3. Verify the request:

   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/requested_reviewers \
     --jq '.users[].login'
   ```

   GitHub reports the requested reviewer as `Copilot`.

Use the native reviewer request. Do not request review through an `@copilot`
comment or use `github-copilot[bot]` as the reviewer.

## Recover From Authentication Failure

If `gh pr edit --add-reviewer @copilot` reports missing `read:org` while
`gh auth status` shows the keyring token has that scope, `GH_TOKEN` is
overriding the keyring token. Retry with:

```bash
env -u GH_TOKEN gh pr edit <number> --add-reviewer @copilot
```

## Handle Review Feedback

1. Evaluate every comment on its merits against the code, specification, and
   repository rules.
2. Record a confidence score before deciding to address or reject the comment.
3. Apply valid feedback to the lowest affected layer of a stacked PR, then
   restack upward.
4. Validate and push the changes.
5. If the PR is ready for review, re-request Copilot review.

The lifecycle is complete only when the current pushed head of every ready PR
has a verified Copilot review request and every existing comment has an explicit
address-or-reject decision.
