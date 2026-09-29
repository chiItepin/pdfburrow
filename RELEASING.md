# Releases

Every new remote tag is a release candidate and must finish with a GitHub Pages
deployment of that exact commit. Creating a tag starts delivery; it does **not**
approve publication. The owner approves each candidate through the protected
`github-pages` environment.

[Tagged Pages release](.github/workflows/pages.yml) owns the triggers, pinned
tools, checks, artifact path, permissions, and queue configuration. It runs for
all tag names, including names containing `/`, rather than a version-prefix
subset. Branch pushes and GitHub Release publication are not deployment triggers.
Each run builds the triggering revision once and deploys that same artifact.

## Release procedure

1. **Qualify the candidate.** Read the open gates in
   [Validate the MVP and prepare GitHub Pages release](https://github.com/chiItepin/pdfburrow/issues/10)
   and the linked canonical decisions. Record evidence against the exact commit
   and artifact: output correctness, document non-egress and network-blocked
   processing, interaction/lifecycle behavior, browser/device coverage, measured
   resource limits, distributed licensing, and hosting. Missing evidence keeps the
   candidate blocked. A green workflow does not replace physical-device or
   licensing evidence.
2. **Check delivery readiness.** The tagged commit must contain the reviewed
   Pages workflow. Repository Pages settings must use **GitHub Actions**, and
   `github-pages` must require `chiItepin` as its reviewer. Naming an environment
   in YAML does not configure its protection. The owner may approve a run they
   started; another agent must not approve it on their behalf.
   The build refuses delivery when the required reviewer rule is missing or changed.
3. **Create and push one new tag.** Confirm the exact commit with the owner.
   Use an annotated tag and push only its ref:

   ```sh
   git tag -a <new-tag> <candidate-commit> -m "Release <new-tag>"
   git push origin refs/tags/<new-tag>
   ```

   Treat tag names as immutable. Push one tag at a time and finish its release
   before starting the next. GitHub can omit tag-push events when more than three
   tags are pushed together. Tags created by another workflow using its default
   `GITHUB_TOKEN` also do not trigger this workflow; use an owner-authenticated
   push for releases.

4. **Review the candidate artifact.** Find the tag's Actions run and require the
   build job to pass. Match `release.json` inside its Pages artifact to the tag
   and candidate commit, and attach the remaining release evidence. Request the
   owner's **Review deployments** approval for `github-pages`; wait for it.
5. **Verify publication.** Require the deployment and published-revision check to
   succeed. The live `release.json` must identify the approved tag and commit.
   Check the tool routes, refresh, local workers, and disclosure links at the
   deployment URL. Record the run URL, tag, commit, and site URL in the release
   record. Only then is the tag's release complete.

## Recovery

An awaiting-approval, rejected, failed, cancelled, or expired run is an
**incomplete release**, not a tag-only success. Preserve its evidence and resolve
the blocker. Re-run the original workflow for a transient failure; an expired
artifact requires rebuilding that same revision and renewed approval. A source
fix uses a new commit and a new tag.

The release queue preserves pending runs rather than replacing them with newer
tags, but GitHub caps it at 100 pending runs and does not promise dispatch-order
execution. Sequential release creation avoids queue loss and older versions
overwriting newer ones. Check that every pushed tag has a run; if a trigger was
missed, investigate before proceeding rather than moving or force-pushing tags.

Rollback is another explicit deployment decision. Obtain owner approval of the
rollback commit and use a new tag on a reviewed revert commit containing the
delivery workflow. Verify publication through the same completion gate.

## Current readiness

Pages infrastructure and automated checks are not evidence that the MVP is
release-ready. The release ticket remains the source of truth for pending
licensing, device/resource calibration, privacy evidence, and publication gates.
Keep development/support disclosures until the corresponding evidence supports
changing them.
