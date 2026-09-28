# PDFBurrow

A React + TypeScript local document workspace with one working tool: **Merge PDFs**.
Add local PDFs, arrange whole files, and explicitly download one merged PDF.
**Split, extraction, and JPEG/PNG conversion are not implemented.**

The [PDFBurrow MVP map](https://github.com/chiItepin/pdfburrow/issues/1) is the
decision index. This workspace implements merge and the shared file-to-download workflow,
not the entire MVP. It is not a release; the selected project license has not yet
been added.

## Run locally

Use Node.js 22.14+ on the 22.x line, or Node.js 24.x, with npm available.
The committed bootstrap scripts install pinned Rush and pnpm versions.

```sh
npm run setup
npm run dev
```

Open `http://127.0.0.1:5173/pdfburrow/` and choose **Merge PDFs**, or bookmark
`http://127.0.0.1:5173/pdfburrow/#/merge`. Select **Add PDFs** or drop files, wait
for validation, arrange them with Move up/down or drag, acknowledge the
preservation limitations, and select **Merge PDFs**. **Download PDF** appears
after generation; downloads never start automatically.

Vite is no longer used. React Compiler runs through Babel on app and shared UI
TypeScript, then esbuild bundles it and the local workers;
Tailwind's CLI compiles the shared shadcn theme. Development watches source files
in a separate `.dev` output directory. Refresh manually when ready: source edits
never trigger a reload that could discard a document draft.

React Compiler targets React 19 in both development and production. It optimizes
eligible components and hooks without manual `useMemo`/`useCallback`; unsupported
async cleanup patterns keep their ordinary behavior and are reported in build
diagnostics. The engine remains React-free. File/output stores use lazy state
initialization for stable ownership, not a memoization cache.

## Shared workspace

- Choose a tool before adding files. Home is `#/`; the implemented merge tool is
  `#/merge`. `#/split` and `#/images` are explicitly unavailable development
  placeholders, not working conversions. Unknown tool addresses show a recovery
  screen. Hashes and history state identify tools only, never documents or settings.
- There is one in-memory draft, not one draft per tool. Home, tool changes, and
  browser Back/Forward require confirmation before discarding nonempty work,
  even after a download was requested. Keep working is the safe default.
  Processing/cancellation locks navigation until the worker has stopped.
  Bookmarks and refresh select a tool but never restore a draft.
- Inputs come before settings in reading/tab order. Desktop places settings beside
  the input list; small screens stack them. Dragging is optional; keyboard ordering,
  removal, focus restoration, and status announcements remain available.
- `apps/web/src/workspace` owns the file registry, PDF validation queue,
  windowed inputs, preview cache, document job lifecycle, and output/download
  ownership. `merge` supplies its operation, preservation acknowledgement, and
  operation-specific copy. `core-ui` owns the reusable file dropzone and dialog.
- Shared downloads retain only metadata in React state and keep Blob references
  in the output store. A single output downloads directly as PDF. Multiple outputs
  expose individual downloads plus **Prepare ZIP for all PDFs**, followed by an
  explicit **Download ZIP**. No download starts just because packaging finished.
  These multi-output controls are ready for the future tools; merge still produces
  exactly one PDF.
- ZIP packaging uses a separate, lazy fflate worker. Cancellation terminates it
  before unlocking, without discarding generated PDFs. Packaging/download errors
  permit explicit retry; editing/reset releases output and ZIP URLs. Filenames are
  sanitized and disambiguated once, so individual names and ZIP entries agree.
- The shared preview queue accepts separate lazy PDF and JPEG/PNG renderers.
  Optional image thumbnails run in a disposable local worker, fit within 144 pixels,
  and never modify originals. This is preview infrastructure, not image conversion
  or required image-input validation; those still belong to the image tool.
- The footer opens local `privacy.html` and `notices.html` disclosures in a new tab
  without discarding work. The notices page explicitly records incomplete release
  licensing, rather than claiming a completed compliance audit.

`PdfLimits`, `BundleLimits`, and `ImagePreviewLimits` are enforcement points for
measured release values, not prepopulated production limits. The registry and
output store report retained raw bytes/counts; ZIP progress reports actual entries
and packaging bytes. These are not measurements of total browser/decoded memory.
Image pixel limits can be checked after decoding, not a guarantee against decode
allocation failure. Physical-device calibration, image validation, page grids,
and operation-specific settings belong to their respective implementation/release
tickets; shared infrastructure does not claim those tools are complete.

## Merge behavior and limitations

- Each file contributes all its pages in displayed file order. A single PDF is
  also accepted. The writer copies page content, boxes, and rotation rather than
  rasterizing pages. Output naming is `<first-input-stem>-merged.pdf`, with unsafe
  characters replaced and an empty-stem fallback of `document`.
- Required worker validation rejects encrypted, zero-page, unparseable,
  structurally invalid, form-bearing, and detected digitally signed inputs.
  Page-tree checks reject missing/unknown children, repeated or cyclic references,
  inconsistent parents, and incorrect page counts before the writer can silently
  omit pages. Valid nested trees retain inherited page geometry and resources.
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
  is not a measured workload limit or virtualization threshold. Drop an input on
  **Previous files** or **Next files** to move it to the adjacent view's nearest
  position; repeat to move farther. Navigation happens on drop, not while hovering,
  so the native drag source stays mounted. Move up/down also works across views.
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
Components use PascalCase `.tsx` filenames; other project-owned JS/TS sources,
tests, and build scripts use camelCase, enforced by lint. Conventional config
names and dotted test/worker suffixes are retained.

| Package               | Responsibility                                                                       |
| --------------------- | ------------------------------------------------------------------------------------ |
| `apps/web`            | React app, shared document workspace, merge views/hooks, and build scripts           |
| `packages/core-ui`    | Shared shadcn primitives, reusable compositions, utilities, and theme                |
| `packages/pdf-engine` | React-free PDF validation/generation, image/PDF previews, ZIP packaging, and workers |
| `packages/tooling`    | Shared TypeScript, ESLint, and formatter tooling                                     |

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
apps/web/node_modules/.bin/playwright install chromium firefox webkit
npm run test:browser
```

`check` runs Prettier verification, type/lint checks, unit and workspace contract
tests, and a production build. Browser tests use separate production and
development servers on ports 4173 and 4174.

Tests inspect real output counts/order, all page boxes/rotation, decoded
text/vector streams, every-page render equivalence, keyboard/focus behavior,
local workers, error recovery, cancellation, download retry, and repeated
merge/download/reset and ZIP packaging cycles with worker/URL cleanup assertions.
Shared download tests use a test-only consumer of the common hooks, never a hidden
production conversion tool. Routing tests cover direct links, refresh, manual
hash changes, guarded Back/Forward, safe discard, and processing locks. Synthetic
fixtures and Chromium mobile emulation do not establish complete compatibility,
physical-device memory budgets, or release-level privacy evidence.

Merge workflow and downloaded-artifact checks run in Playwright's Chromium,
Firefox, and WebKit, plus Chromium mobile emulation. These browser builds are
not evidence for the complete current/previous-major or physical-device matrix.
The preservation fixtures include subset-embedded Greek/Cyrillic/accented text,
mixed page boxes, rotations and user units, ordinary vectors, an image-only scan,
and warning-bearing links/attachments. An independent PDF.js reader checks the
download's exact text and every page's rendered pixels against the sources;
annotation rendering is excluded because annotation preservation is not promised.
The test-only font comes from PDF.js's installed `standard_fonts`, with its
`LICENSE_LIBERATION`; fontkit and the fixture font are not added to application assets.

`tests/fixtures` contains generated, non-user PDFs: actual RC4-encrypted documents
with an empty and a nonempty opening password, and a detached CMS-signed document.
PDF.js independently opens the encrypted fixtures with the expected credentials;
the app rejects both, with no password/bypass path. Regenerate these fixtures with
`node tests/fixtures/generateProtectedPdfs.mjs` when needed (requires OpenSSL).
The generator verifies the detached signature and removes its temporary private
key. The self-signed certificate is test data, not a trusted identity; these cases
do not establish exhaustive encryption/signature detection. The normal test run
uses the saved fixtures and does not require OpenSSL.

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
For self-hosting, serve all of `apps/web/dist`, including the two static disclosure
pages and `assets/`, under the same base path used during build. Hash routes require
no server-side route rewriting. The host receives ordinary asset requests and may
log them; visitors' documents are processed locally. Self-hosting does not provide
an offline-startup or PWA guarantee.
Development and production outputs are separate. Production deployments should
replace the output directory atomically and revalidate fixed-name entry assets
rather than applying immutable caching to them.

The engine uses pdf-lib 1.17.1 (MIT), PDF.js 5.7.284 (Apache-2.0), and fflate 0.8.2
(MIT); installed
packages retain upstream license texts. The owner selected MIT for PDFBurrow,
attributed to PDFBurrow contributors; adding the project license and complete
redistribution notices remains required before release. The shadcn attribution
is retained in `packages/core-ui/NOTICE.txt`.

No hosting workflow, backend, analytics, document persistence, or Office engine
is included. On-device processing is the primary product promise; it does not
imply offline availability or an absence of hosting requests. Licensing, privacy,
and owner approval for every release commit are governed by
[Decide licensing, privacy claims, and release readiness](https://github.com/chiItepin/pdfburrow/issues/7).
