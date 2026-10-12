# Repository guidance

- Code changes: follow [CODING_STANDARDS.md](CODING_STANDARDS.md).
- UI changes: always use shadcn/ui components through `@repo/core-ui`, including
  form controls and labels. Add missing shadcn primitives to the shared package
  first; never substitute hand-styled native controls. Follow the
  [React and UI rules](CODING_STANDARDS.md#react-and-ui) before editing any UI.
- Pull request creation and updates: follow the
  [Copilot review lifecycle](.github/skills/copilot-pr-code-review/SKILL.md).
  Wait for Copilot's `APPROVED` review on the latest pushed head before reporting
  PR completion. If approval is unavailable, report the blocker; a pending or
  `COMMENTED` review is not approval.
- Releases: before creating or pushing tags, changing Pages delivery, or approving
  publication, read [RELEASING.md](RELEASING.md).
