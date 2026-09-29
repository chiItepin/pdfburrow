---
name: pages-release
description: Guide Pages releases when the user explicitly asks to release PDFBurrow, resume a candidate, or inspect a completed release.
---

# Pages release

Invoke `/pages-release` with the intended tag and candidate commit, or the existing
tag/run to resume or inspect. Act only on an explicit user request; loading or
invoking this skill is not authorization to push or publish.

1. **Load the release contract.** Read [RELEASING.md](../../../RELEASING.md),
   including the current release ticket and its linked decisions, before acting.
   It owns readiness, authorization, recovery, and publication criteria; this
   skill is only a guide through that procedure. Missing evidence blocks release.
2. **Identify the release.** Resolve the intended revision to its full commit
   SHA. For a previously published release, follow **Completed release lookup**
   in the guide and return without entering steps 3-6. This read-only path uses
   historical evidence, not today's readiness or live-site state, to establish
   past completion; missing evidence means unverified history, not a retry.
   For a new tag, obtain the owner's explicit approval of that exact commit,
   tag, and tag push. Ask for missing inputs or approval rather than assuming `HEAD`, a tag
   name, or consent from passing checks. Qualify the candidate against the release
   gates, retaining the exact-artifact evidence required before publication.
3. **Check readiness and recovery.** Verify the Git remote targets
   `chiItepin/pdfburrow`, the push uses owner-authenticated credentials, the
   candidate contains the reviewed [Pages workflow](../../workflows/pages.yml),
   and live Pages/environment settings satisfy the release guide. Report access
   errors or missing protection as blockers; do not change settings.
   Validate the literal tag name using the release guide. Inspect local and remote tags and existing Pages
   runs before creating anything. If the tag or its run already exists, preserve
   it and check its peeled commit and provenance. Route a completed release to
   **Completed release lookup** and return; for an incomplete candidate, use
   **Recovery** in the guide.
   Conflicting provenance blocks release. A missing trigger or another unfinished
   candidate blocks a new release except for the guide's explicitly authorized
   **Missing tag-push run** recovery. Follow that branch's absence checks and
   owner authorization before treating a new tag as a replacement.
   Never move, delete, or force-push release tags.
4. **Start or resume the candidate.** Only after the preceding gates pass, use
   the guide's annotated-tag commands for one unused tag on the approved SHA,
   pushing only that tag's ref. Quote all supplied values as literal arguments.
   For an existing candidate, follow the documented recovery path; create a
   replacement tag only under its missing-trigger exception. Identify its run with:

   ```sh
   gh run list --repo chiItepin/pdfburrow --workflow pages.yml --event push \
     --commit "$commit" \
     --json databaseId,headBranch,headSha,status,conclusion,url
   ```

   Match both the exact tag and full commit, not merely the latest run or a shared
   commit. Paginate if needed; a missing match requires the guide's absence
   investigation, not an automatic retry push. This workflow is tag-triggered,
   not manually dispatched.

5. **Hand off approval.** Require the matching build to pass and inspect
   `release.json` in that run's Pages artifact for the exact tag/commit. Complete
   the remaining artifact evidence from the guide, then give the owner the run
   URL and direct them to **Review deployments** for `github-pages`. Only the
   owner approves; never approve on their behalf or treat the build as approval.
   For missing-trigger recovery, first apply the guide's late-run checks and
   owner rejection/cancellation gate for every superseded tag.
   While waiting, report **incomplete: awaiting owner approval**.
6. **Verify and record current publication.** For a new or resumed deployment,
   follow the guide's publication checks:
   deployment and published-revision check succeed, live `release.json` matches
   the approved tag/commit, and the documented site checks pass. Record the tag,
   full commit, run URL, site URL, and evidence in the release record and report
   them to the owner. Keep the recovery chain's superseded tags and any late-run
   dispositions in that record as incomplete, and apply the guide's chain-completion
   gate before starting another release.
   Pending approval, rejection, failure, cancellation, expiry,
   or missing verification means **incomplete**, with the blocker and recovery
   action stated; only the full publication gate permits reporting success.
