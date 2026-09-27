# Coding standards

This is the canonical home for repository coding style, conventions, and
implementation guidelines. Keep these rules here, not in `AGENTS.md`.
The owner's current direction supersedes the earlier Vite architecture decision:
use React, TypeScript, shadcn/ui, and a small esbuild build; do not add Vite.

## Small interfaces, substantial implementations

- Keep files focused on one responsibility. Prefer files around 50-200 lines;
  reconsider the boundary before exceeding 250. Do not split code arbitrarily to
  hit a number, or replace a god component with a god hook.
- Keep `App` as composition. UI components render and report intent; dedicated
  modules own draft editing, validation, execution, previews, and downloads.
- Prefer deep modules: a small public API hides meaningful implementation and
  resource management. Do not make callers coordinate library internals.
- Avoid speculative abstractions, generic frameworks, pass-through services, and
  global mutable state. Extract a boundary when it owns behavior or a lifecycle,
  not just because two lines can be moved into a file.

## Names, functions, and types

- Prefer named arrow-function bindings, including React components and hooks.
  Use descriptive verbs such as `validatePdf`, `removeFile`, and `requestDownload`.
  Use `use` for hooks, PascalCase for components/types, camelCase for values,
  and descriptive kebab-case filenames except the app's `App.tsx` entry.
- Prefer self-explanatory code over comments. Comments are rare and explain a
  non-obvious constraint, third-party workaround, or invariant, never narrate code.
  JSDoc needed to type-check JavaScript tooling is appropriate. Retain license
  notices and upstream attribution.
- Keep TypeScript strict. Use discriminated unions for state and outcomes,
  `import type` for types, and readonly contracts where mutation is not intended.
  Avoid `any`, double casts, and unchecked assertions; narrow values explicitly.
- Prefer `const`, early returns, strict equality, explicit braces, and simple
  control flow. Do not silently accept invalid inputs or catch errors without
  reporting a useful failure at the owning boundary.

## Packages and imports

- Import shared UI from the explicit `@repo/core-ui` barrel. It exports only the
  supported components/utilities; the stylesheet is a separate side-effect entry.
- Use `@repo/pdf-engine` for types and capability barrels
  `@repo/pdf-engine/merge` and `@repo/pdf-engine/preview` for lazy runtime APIs.
  Do not combine preview libraries and PDF generation in an eager root barrel.
- Use explicit named exports in package/feature entry barrels. Avoid `export *`,
  barrels in every folder, cross-package `/src/` imports, and internal imports
  through the package's own barrel (which can create cycles).
- Dependency direction is `web -> core-ui` and `web -> pdf-engine`. Shared UI
  does not know about PDFs; the engine does not import React or UI.
  `tooling` is development-only. Workers are private build entries.

## React and UI

- Use shadcn/ui primitives from `core-ui` and its shared theme, variants, spacing,
  and focus styles. Do not introduce competing component libraries or duplicate
  buttons/dialog styling inside features.
- Generate primitives into `packages/core-ui/src/primitives`; review generated
  imports and expose approved additions through the package barrel. Keep
  PDF-specific views in the app, reusable compositions in `core-ui`.
- Hooks must respect React's recommended lint rules. Effects synchronize with
  external systems and clean up their work; derive state during rendering when
  possible. Keep original files and output buffers outside render state.
- Every action must work by keyboard without dragging. Preserve focus, safe
  confirmation defaults, noninterrupting progress, and descriptive accessible
  names. Optional previews must not become required validation.

## Build and resource ownership

- Rush owns dependency installation and the lockfile. Change the owning package
  manifest, then run `npm run update`. Never install at the repository root.
- esbuild bundles React/TypeScript and explicit local worker entries. Tailwind's
  CLI builds the shared stylesheet. Development uses watched builds and manual
  refresh, not automatic reload that could discard a document draft.
- Support both `/pdfburrow/` and `/` via `PDFBURROW_BASE_PATH`. Keep assets and
  workers same-origin and base-aware; never add a remote processing fallback.
- Each resource has an owner and cleanup path: the app retains originals and
  output URLs; the engine owns workers; preview requests are separately released.
  Cancellation must stop execution and reject late results before restoring edits.

## Formatting, linting, and evidence

- Prettier owns formatting: two spaces, semicolons, double quotes, trailing commas,
  parenthesized arrow parameters, LF, and a 100-column target. Run `npm run format`.
- `npm run format:check` and `npm run lint` enforce formatting, recommended
  JavaScript/TypeScript rules, React Hooks, JSX accessibility, and package
  boundaries. Generated/vendor files and lockfiles are not hand-reformatted.
- Tests must verify observable behavior and real PDF artifacts, not only a success
  state. Cover failures, cancellation, downloads, focus, repeated jobs, worker
  cleanup, and both development and production asset loading.
- Run `npm run check` and `npm run test:browser` before handing off changes.
  Do not claim broad compatibility or measured resource safety without evidence.
