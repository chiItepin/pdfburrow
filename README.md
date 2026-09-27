# PDFBurrow

A React + TypeScript development build with one working tool: **Merge PDFs**.
Add local PDFs, arrange whole files, and explicitly download one merged PDF.
**Split, extraction, and JPEG/PNG conversion are not implemented.**

The [PDFBurrow MVP map](https://github.com/chiItepin/pdfburrow/issues/1) is the
decision index. This workspace implements merge and the shared workflow it needs,
not the entire MVP. It is not a release or a license selection.

## Run locally

Use Node.js 22.14+ on the 22.x line, or Node.js 24.x, with npm available.
The committed bootstrap scripts install pinned Rush and pnpm versions.

```sh
npm run setup
npm run dev
```

Open `http://127.0.0.1:5173/pdfburrow/`. Select **Add PDFs** or drop files, wait
for validation, arrange them with Move up/down or drag, acknowledge the
preservation limitations, and select **Merge PDFs**. **Download PDF** appears
after generation; downloads never start automatically.

Vite is no longer used. esbuild bundles React/TypeScript and the local workers;
Tailwind's CLI compiles the shared shadcn theme. Development watches source files
in a separate `.dev` output directory. Refresh manually when ready: source edits
never trigger a reload that could discard a document draft.

## Merge behavior and limitations

- Each file contributes all its pages in displayed file order. A single PDF is
  also accepted. The writer copies page content, boxes, and rotation rather than
  rasterizing pages. Output naming is `<first-input-stem>-merged.pdf`, with unsafe
  characters replaced and an empty-stem fallback of `document`.
- Required worker validation rejects encrypted, zero-page, unparseable,
  structurally invalid, form-bearing, and detected digitally signed inputs.
  Rejected files remain visible and block merging until retried or removed.
  No password bypass, repair, flattening, or silent skipping is implemented.
- Every PDF input set requires acknowledgement: this is page-focused rewriting,
  not lossless preservation. Annotations and visible marks may change or
  disappear; bookmarks, attachments, metadata, accessibility, and PDF/A guarantees
  are not preserved. Detection is not exhaustive.
- Adding/removing files clears acknowledgement; reordering does not. Optional
  first-page thumbnails do not establish export support or replace validation.
- One required validation and one optional preview run at a time. Eight inputs
  are displayed per view; only that view's thumbnails are retained. This UI bound
  is not a measured workload limit or virtualization threshold.
- Generation pauses previews and locks editing. Cancel stops its disposable
  worker, then restores the unchanged draft. No elapsed-time generation cutoff
  or automatic retry is used.
- Editing clears previous output, with confirmation if no download was requested.
  Start over confirms nonempty work and releases app-held resources without
  changing originals or downloaded files. This is not forensic erasure.
- Refreshing/closing the tab loses memory-only work; leave warnings are best
  effort. There are no document uploads or automatic document persistence.
  Static hosting receives application-asset requests. Offline/PWA operation is
  not promised.

**Not release-ready:** safe resource limits and the complete browser/device
matrix are not calibrated. Large/complex inputs may exhaust browser memory.
`PdfLimits` provides enforcement points for future measured values; the app does
not invent production limits. The full PDF fixture matrix, physical devices,
aggregate parsed-memory accounting, and scheduling calibration remain gates in
[Validate the MVP and prepare GitHub Pages release](https://github.com/chiItepin/pdfburrow/issues/10).

## Repository guide

**[CODING_STANDARDS.md](CODING_STANDARDS.md)** owns coding conventions: focused
modules, descriptive arrow functions, minimal comments, package entry barrels,
React/shadcn practices, dependency boundaries, formatting, and lint rules.

| Package               | Responsibility                                                                     |
| --------------------- | ---------------------------------------------------------------------------------- |
| `apps/web`            | React app, merge-specific views/hooks, file registry, downloads, and build scripts |
| `packages/core-ui`    | Shared shadcn primitives, reusable compositions, utilities, and theme              |
| `packages/pdf-engine` | React-free PDF validation, generation, workers, and preview lifecycle              |
| `packages/tooling`    | Shared TypeScript, ESLint, and formatter tooling                                   |

Rush owns installation and `common/config/rush/pnpm-lock.yaml`. Do not run
`npm install` or `pnpm install` at the root or inside packages.

```sh
# After changing the owning package manifest:
npm run update

# Preview and generate a shared shadcn primitive:
npm run ui:add -- button --dry-run
npm run ui:add -- button --yes
```

Predeclare any new dependency in `core-ui` and run `npm run update` before
generation. Review generated imports, keep internal imports relative, and expose
approved primitives through `core-ui`'s barrel. Do not overwrite customizations.

## Validate and format

```sh
npm run format
npm run check
apps/web/node_modules/.bin/playwright install chromium
npm run test:browser
```

`check` runs Prettier verification, type/lint checks, unit and workspace contract
tests, and a production build. Browser tests use separate production and
development servers on ports 4173 and 4174.

Tests inspect real output counts/order, all page boxes/rotation, decoded
text/vector streams, first-page render equivalence, keyboard/focus behavior,
local workers, error recovery, cancellation, download retry, and repeated
merge/download/reset cycles with worker/URL cleanup assertions. Synthetic
fixtures and Chromium mobile emulation do not establish complete compatibility,
physical-device memory budgets, or release-level privacy evidence.

## Production build and base paths

```sh
npm run build
npm run preview
```

The default base is `/pdfburrow/`. The production output is `apps/web/dist`.
For a future custom-domain root:

```sh
PDFBURROW_BASE_PATH=/ npm run build
PDFBURROW_BASE_PATH=/ npm run test:browser
PDFBURROW_BASE_PATH=/ npm run preview
```

Build and preview must use the same base; preview rejects a mismatch. A plain
`npm run build` restores the default subpath output. Worker URLs resolve beside
the emitted modules under `assets/`; build scripts explicitly bundle each worker
and keep generation and preview capability entries separate and lazy.

The local server serves only the generated output, never repository source.
Development and production outputs are separate. Production deployments should
replace the output directory atomically and revalidate fixed-name entry assets
rather than applying immutable caching to them.

The engine uses pdf-lib 1.17.1 (MIT) and PDF.js 5.7.284 (Apache-2.0); installed
packages retain upstream license texts. Complete redistribution notices and an
owner-selected project license remain required before release. The shadcn
attribution is retained in `packages/core-ui/NOTICE.txt`.

No hosting workflow, backend, analytics, document persistence, or Office engine
is included. Publication and licensing remain with
[Decide licensing, privacy claims, and release readiness](https://github.com/chiItepin/pdfburrow/issues/7).
