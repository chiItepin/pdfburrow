# PDFBurrow

A development foundation for an on-device PDF application. **Merge, split,
extraction, and JPEG/PNG conversion are not implemented yet.** The current screen
exercises shared UI and a lazy-loaded local worker without accepting documents.

The [PDFBurrow MVP map](https://github.com/chiItepin/pdfburrow/issues/1) is the
decision index. This workspace implements
[Implement the approved Vite and shadcn workspace](https://github.com/chiItepin/pdfburrow/issues/13);
it is not a release or a license selection.

## Run locally

Use Node.js 22.14+ on the 22.x line, or Node.js 24.x, with npm available.
The committed Rush bootstrap scripts install the pinned Rush and pnpm versions.
No global Rush/pnpm installation is necessary.

```sh
npm run setup
npm run dev
```

Open the local URL printed by Vite (normally
`http://127.0.0.1:5173/pdfburrow/`). The "Check local worker" action loads an engine
diagnostic only when requested, starts a same-origin worker, then terminates it
on response, error, cancellation, or timeout.

Do not run `npm install` or `pnpm install` at the repository root or within
packages. Rush owns dependency installation and its workspace lockfile. The
root package is only a command facade and intentionally has no dependencies.

## Workspace

| Package | Responsibility |
| --- | --- |
| `apps/web` (`@repo/web`) | React/Vite app, app-specific interactions and future downloads |
| `packages/core-ui` (`@repo/core-ui`) | Shared generated primitives, compositions, hooks, utilities and styles |
| `packages/pdf-engine` (`@repo/pdf-engine`) | React-free input/output types and local worker boundary |
| `packages/tooling` (`@repo/tooling`) | Development-only TypeScript and ESLint configuration |

The app may depend on core-ui and pdf-engine. Neither library may depend on the
app or on the other library. Engine code cannot import React. Tooling is never a
runtime dependency. ESLint and the workspace tests enforce these boundaries.

Internal packages export TypeScript source, not separately built JavaScript.
Their build scripts type-check; Vite bundles the web app. DOM, WebWorker and Node
type environments are configured separately.

Core-ui owns the only `components.json`. Public paths are
`@repo/core-ui/primitives/*`, `components/*`, `hooks/*`, `lib/*`, and `styles.css`.
There is no root barrel and no cross-package `/src/` import. The hooks directory
is reserved for real reusable hooks as they are needed; it has no placeholder API.
The app's `@/` alias is app-local.

Import `@repo/core-ui/styles.css` exactly once from the app entry. It owns the
theme and explicitly scans both app and shared UI sources with Tailwind.
The development screen uses system fonts; it fetches no third-party fonts.

## Dependencies and shadcn

Edit a package's dependency manifest, then run:

```sh
npm run update
```

Keep `common/config/rush/pnpm-lock.yaml` and `repo-state.json` with manifest
changes. `npm run setup` consumes that lockfile without updating it.
Never add a parallel root `pnpm-workspace.yaml` or a package-local lockfile.

Preview generation before adding a component:

```sh
npm run ui:add -- button --dry-run
```

Predeclare any dependencies shown by the preview in `packages/core-ui/package.json`
and run `npm run update` **before** generating:

```sh
npm run ui:add -- button --yes
```

This matters because shadcn's automatic `pnpm add` cannot discover Rush's
workspace in `common/temp`. Once dependencies are present, the CLI skips that
step. Do not overwrite customized primitives without inspecting the diff.
Generated primitives belong in `src/primitives`, and composition wrappers in
`src/components`. The current registry imports `cn` directly; route that import
through `@repo/core-ui/lib/utils`, the shared utility alias. The checked-in button
was generated with shadcn 4.21.0 and adapted only at that import.
Its upstream license notice is in `packages/core-ui/NOTICE.txt`.

## Validate

```sh
npm run check
apps/web/node_modules/.bin/playwright install chromium
npm run test:browser
```

`check` runs all package type/lint checks, workspace contract tests and the
production build. Browser tests start and stop their own production preview on
port 4173. They cover desktop/mobile Chromium layouts, keyboard operation,
production Tailwind from both packages, lazy engine loading, local worker URLs,
repeated checks, and visible failure/timeout recovery.

Chromium mobile emulation is not evidence for the final mobile-browser support
policy. Actual document behavior, cancellation of generation, PDF.js previews,
ZIP packaging, physical-device budgets, and release-level privacy/network
evidence belong to subsequent tickets.

## Base paths and workers

The development default is `/pdfburrow/`. An explicit base override must start
and end with `/`; for a future custom-domain root, use:

```sh
PDFBURROW_BASE_PATH=/ npm run build
PDFBURROW_BASE_PATH=/ npm run test:browser
PDFBURROW_BASE_PATH=/ npm run preview
```

Use the same base for building and previewing. `npm run build` deliberately uses
Rush's full `rebuild`, so changing the base or removing generated output cannot
reuse stale assets, including before new files have been committed. The web
project also declares `PDFBURROW_BASE_PATH` as an input for future build caching.
Running `npm run build` without the override restores the default subpath output.

Engine clients create workers via
`new Worker(new URL("./name.worker.ts", import.meta.url), { type: "module" })`.
Keep that URL statically analyzable so Vite emits a local, hashed asset and
rewrites its path for the configured base. Future assets should use module
imports or `import.meta.env.BASE_URL`, never hard-coded root URLs or a CDN.
Future generation and preview modules must retain separate lazy lifecycles;
the diagnostic does not establish either job contract.

The build output is `apps/web/dist`. No hosting workflow, backend, upload
endpoint, analytics, document persistence, or Office engine is included.
The project license, complete dependency notices and release approval remain
with [Decide licensing, privacy claims, and release readiness](https://github.com/chiItepin/pdfburrow/issues/7).
