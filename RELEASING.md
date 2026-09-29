# Releases

Every new remote tag is a release candidate. Completion requires a GitHub Pages
deployment of that exact commit; only the missing-trigger recovery below permits
retiring a candidate as **incomplete/superseded** instead of deploying it.
Creating a tag starts delivery; it does **not** approve publication. The owner
approves each candidate through the protected `github-pages` environment.

For guided execution, invoke the repository's [pages-release skill](.github/skills/pages-release/SKILL.md)
with `/pages-release` and the intended tag/commit, or an existing tag/run to resume
or inspect.

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
   Set `tag` to the approved literal tag name and `commit` to the approved full
   commit SHA. Before creating anything, validate the name with
   `git check-ref-format "refs/tags/$tag"` and reject names beginning with `-`;
   `git tag` rejects those even after `--`. Preserve the full name, including
   slashes, and quote supplied values to keep shell metacharacters literal.
   Use an annotated tag and push only its ref:

   ```sh
   git tag -a -m "Release $tag" -- "$tag" "$commit"
   git push origin "refs/tags/$tag"
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
   record. Only then is the tag's release complete. Later read-only lookups use
   the historical verification below, not a new publication gate.

## Completed release lookup

Inspecting a previously published release is read-only. Match the exact tag and
full commit to its recorded successful deployment and published-revision check,
artifact `release.json` provenance, and release evidence, including the site
checks recorded at publication. Retained evidence can establish completion after
the downloadable artifact expires; expiry alone does not undo a verified release.
If that evidence is missing or inconsistent, report **historical completion
unverified** with the gap, rather than claiming success or rerunning deployment.

Report the historical tag, commit, run URL, and site URL without implying that
version remains live. A different current `release.json` does not make a verified
past release incomplete. Only claim **currently live** after checking the current
deployment and live tag/commit; if those checks are unavailable, report current
live status as unverified. Return without pushing tags, rerunning workflows, or
requesting deployment approval. Publishing an older revision again is a separate
owner-authorized rollback, not a historical lookup.

## Recovery

An awaiting-approval, rejected, failed, cancelled, or expired run is an
**incomplete release**, not a tag-only success. Preserve its evidence and resolve
the blocker. Re-run the original workflow for a transient failure; an expired
artifact requires rebuilding that same revision and renewed approval. A source
fix uses a new commit and a new tag.

The release queue preserves pending runs rather than replacing them with newer
tags, but GitHub caps it at 100 pending runs and does not promise dispatch-order
execution. Sequential release creation avoids queue loss and older versions
overwriting newer ones. Check that every pushed tag has a run. Resolve an
incomplete release before starting the next, except for the explicitly authorized
replacement below. Never move, delete, or force-push release tags.

Rollback is another explicit deployment decision. Obtain owner approval of the
rollback commit and use a new tag on a reviewed revert commit containing the
delivery workflow. Verify publication through the same completion gate.

### Missing tag-push run

This workflow has no manual trigger. A confirmed missing event may be recovered
with one new tag for the **same exact approved commit**, not by re-pushing the
original tag.

1. **Confirm absence.** Verify the original remote tag's peeled commit and search
   all Pages push runs for that exact tag and full commit, including queued and
   completed runs; paginate beyond the default results. Allow for event visibility
   delays, investigate the push credentials, batched tags, and Actions incidents,
   then repeat the search. Record the checks and cause, if known. An access error,
   a deleted run, or an ambiguous result is not proof of a missing event and
   blocks replacement. If a run exists, use the existing-run recovery above.
2. **Authorize one replacement.** With no other unfinished candidate outside this
   recovery chain, obtain explicit owner authorization for the original tag's
   supersession, one unused replacement tag, its identical full commit SHA, and
   its owner-authenticated push. Record that decision and link both tags in the
   release record. Keep the original tag immutable; it remains incomplete, never
   a successful release. All readiness gates still apply.
3. **Push and complete the replacement.** Recheck for an original run immediately
   before pushing; if one appeared, stop the replacement and recover that run.
   Also resolve any late runs for already-superseded tags as below before pushing.
   Then use the normal annotated-tag procedure, push only the replacement ref,
   and record the original as **incomplete/superseded** by it. Require the
   replacement's own run, exact tag/commit artifact evidence, owner deployment
   approval, and live verification. Finish this recovery chain before starting
   an unrelated release. If the replacement also has no run, repeat the full
   diagnosis and obtain fresh owner authorization for any further replacement;
   never automatically create retry tags.
4. **Contain late runs.** Check every superseded tag for late runs before owner
   approval and before starting the next release. Any late run for a superseded
   tag stays blocked at the protected environment: do not approve or rerun it.
   Have the owner reject or cancel any nonterminal late run; confirm all such runs
   are terminal before pushing or approving a replacement or proceeding with
   another release. Preserve that disposition in the release record. Apply the
   same rule to late runs discovered after recovery completes; within this chain,
   only the active replacement may be published.

## Current readiness

Pages infrastructure and automated checks are not evidence that the MVP is
release-ready. The release ticket remains the source of truth for pending
licensing, device/resource calibration, privacy evidence, and publication gates.
Keep development/support disclosures until the corresponding evidence supports
changing them.

The owner closed the validation ticket administratively, not as evidence that
its gates passed. Subsequent authorization to address the gaps using best guesses
permits the shared **provisional** workload policy; it does not turn estimates into
calibration or waive physical-device coverage. The project now carries its MIT
license and build-generated distributed notices from the shipped packages. Confirm
contributor licensing rights before publication.

After building the candidate, run `npm run test:privacy` with the same
`PDFBURROW_BASE_PATH`. The generated `apps/web/dist/release-evidence.json` identifies
the tested files by SHA-256, commit and dirty-worktree status, environment, fixtures,
network observations, and remaining gates. The Pages workflow generates it after
`release.json` so provenance is included in the hash manifest. A local dirty-worktree
report is development evidence, not evidence for the unchanged `main` commit.
Repeat applicable qualification on the final clean release commit.

Current automated evidence cannot establish physical iPhone/iPad/Android behavior,
the current/previous stable-major matrix, or measured memory/performance margins.
On macOS, Playwright WebKit's offline emulation blocks local Blob reads; that scenario is an
explicit gap, not silently counted as passing. An owner-approved narrower release
policy would need to be recorded explicitly; the experimental UI label alone
does not change publication requirements.
