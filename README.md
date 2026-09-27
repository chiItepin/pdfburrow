# PDFBurrow

A development build with one working tool: **Merge PDFs**. Add local PDFs,
arrange whole files, and explicitly download one merged PDF. **Split, extraction,
and JPEG/PNG conversion are not implemented.**

The [PDFBurrow MVP map](https://github.com/chiItepin/pdfburrow/issues/1) is the
decision index. This workspace implements the merge feature and the shared
workflow it needs, not the entire MVP. It is not a release or a license selection.

## Run locally

Use Node.js 22.14+ on the 22.x line, or Node.js 24.x, with npm available.
The committed Rush bootstrap scripts install the pinned Rush and pnpm versions.
No global Rush/pnpm installation is necessary.

```sh
npm run setup
npm run dev
```

Open the local URL printed by Vite (normally
`http://127.0.0.1:5173/pdfburrow/`). Select **Add PDFs** or drop files, wait for
validation, arrange them with Move up/down or drag, acknowledge the preservation
limitations, and select **Merge PDFs**. **Download PDF** appears after generation;
downloads never start automatically.

Do not run `npm install` or `pnpm install` at the repository root or within
packages. Rush owns dependency installation and its workspace lockfile. The
root package is only a command facade and intentionally has no dependencies.

## Merge behavior and limitations

- Each file contributes all its pages, in displayed file order. A single PDF is
  also accepted. The writer copies page content, boxes, and rotation rather than
  rasterizing pages. Outputs are named `<first-input-stem>-merged.pdf`, with
  unsafe filename characters replaced and an empty-stem fallback of `document`.
- Required worker validation rejects encrypted, zero-page, unparseable,
  structurally invalid, form-bearing, and detected digitally signed inputs.
  Rejected files remain visible and block merging until retried or removed.
  No password bypass, repair, flattening, or silent skipping is implemented.
- Every PDF input set requires explicit acknowledgement: this is page-focused
  rewriting, not lossless preservation. Annotations and visible marks may change
  or disappear; bookmarks, attachments, metadata, accessibility, and PDF/A
  guarantees are not preserved. Detection is not exhaustive.
- Adding/removing files clears acknowledgement; reordering does not.
  First-page thumbnails are optional and do not establish export support.
  Preview errors do not override successful required validation.
- Originals live in an app-owned File registry, not document buffers in React
  state. One required validation and one optional preview run at a time.
  The list displays eight files per view with pagination; only that view's
  thumbnails are retained. This is an initial UI bound, not a calibrated workload
  limit or a measured virtualization threshold.
- Generation pauses previews, locks editing, and remains cancellable by
  terminating its disposable worker. There is no elapsed-time generation cutoff.
  Cancel restores the unchanged draft. Failures retain inputs for explicit retry.
- Editing results clears the previous output, with confirmation if no download
  has been requested. Start over always confirms a nonempty workspace.
  Reset releases app-held files, thumbnails, output URLs, and workers; it does not
  overwrite source files, remove downloads, or promise forensic memory erasure.
- Refreshing/closing the tab loses memory-only work. Leave warnings are best
  effort. No documents are uploaded or automatically persisted. Static hosting
  still receives requests for application assets; there is no offline/PWA promise.

**Not release-ready:** safe resource limits and the complete browser/device
matrix are not calibrated. Large/complex inputs may exhaust browser memory.
`PdfLimits` provides explicit byte/count/page/output enforcement points for future
measured values; the app does not supply guessed production limits. The full
fixture matrix (including embedded/non-Latin fonts, real signed/encrypted PDFs,
complex scans, and physical devices), aggregate parsed-memory accounting,
delayed-job threshold and final scheduling calibration remain release gates in
[Validate the MVP and prepare GitHub Pages release](https://github.com/chiItepin/pdfburrow/issues/10).

## Workspace

| Package | Responsibility |
| --- | --- |
| `apps/web` (`@repo/web`) | React/Vite merge workspace, file registry, preview URLs and downloads |
| `packages/core-ui` (`@repo/core-ui`) | Shared generated primitives, compositions, hooks, utilities and styles |
| `packages/pdf-engine` (`@repo/pdf-engine`) | React-free validation, PDF copying, worker execution and PDF.js preview lifecycle |
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
The engine uses pdf-lib 1.17.1 (MIT) and PDF.js 5.7.284 (Apache-2.0), pinned
through Rush. Upstream license texts ship in their installed packages. Complete
redistribution notices, including transitive dependencies, must be assembled
before a public release; adding these dependencies does not select the project's
own license. Previews do not load remote document resources, fonts, CMaps or WASM.

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

`check` runs all package type/lint checks, workspace contract and PDF artifact
tests, and the production build. Engine tests use Node's experimental TypeScript
transform support. They compare actual output page count/order, all page boxes,
rotation, and decoded text/vector content streams, and exercise rejection,
warning, naming and supplied-limit boundaries.

Browser tests start and stop their own production preview on port 4173 and
development server on port 4174. The development smoke test exercises Rush's
sibling-package worker URLs (Vite must explicitly allow the workspace root and
pre-optimize lazy engine dependencies to avoid discarding a draft on reload).
They cover desktop/mobile Chromium layouts, keyboard/focus operation, PDF downloads,
first-page render equivalence, lazy local workers, validation and preview failures,
forced synchronous-worker cancellation, confirmation, download retry, and 20
repeated merge/download/reset cycles with app-owned worker/URL cleanup assertions.

Chromium mobile emulation is not evidence for the final mobile-browser support
policy. Synthetic fixtures and worker/URL counters do not establish full PDF
compatibility, garbage-collection behavior, physical-device budgets, or
release-level privacy/network evidence. ZIP packaging is not part of merge.

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
Generation and preview modules have separate lazy lifecycles. PDF bytes are read
inside the generation worker from cloned Blob references, preserving recoverable
originals in the app. Optional PDF.js rendering uses its own local worker.

The build output is `apps/web/dist`. No hosting workflow, backend, upload
endpoint, analytics, document persistence, or Office engine is included.
The project license, complete dependency notices and release approval remain
with [Decide licensing, privacy claims, and release readiness](https://github.com/chiItepin/pdfburrow/issues/7).
