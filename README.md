# PDFBurrow

A React + TypeScript local document workspace with **Merge PDFs**,
**Split / Extract**, and **Images to PDF**. Combine whole PDFs, choose pages from
one source, or convert ordered static JPEG/PNG images, then explicitly download
PDFs or a ZIP of multiple outputs.

The [PDFBurrow MVP map](https://github.com/chiItepin/pdfburrow/issues/1) is the
decision index. This workspace implements the three MVP tools and the shared
file-to-download workflow, but still lacks release calibration and complete
compatibility evidence. It is not a release; the selected project license has not yet
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

Merge accepts PDF content only. The native picker's PDF filter is advisory and
some browsers allow selecting other file types; validation rejects PNG/JPEG
images even if renamed to `.pdf`. Selecting an image does not convert it.

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

- The responsive shadcn sidebar contains Home and the three document tools; on
  phones it opens as a keyboard-accessible drawer. The page header uses breadcrumbs,
  with a compact ellipsis menu on narrow screens. Every navigation entry preserves
  the same discard confirmation and processing lock.
- The sidebar's **Dark mode** switch selects light or dark appearance throughout
  the workspace. Dark is the default; only this preference is saved in local
  storage, never documents. If preference storage is unavailable, the switch still
  works for the visit and reports that the choice could not be saved.
- Choose a tool before adding files. Home is `#/`; the implemented merge tool is
  `#/merge`; split/extraction is `#/split`; JPEG/PNG conversion is `#/images`.
  Unknown tool addresses show a recovery
  screen. Hashes and history state identify tools only, never documents or settings.
- There is one in-memory draft, not one draft per tool. Home, tool changes, and
  browser Back/Forward require confirmation before discarding nonempty work,
  even after a download was requested. Keep working is the safe default.
  Processing/cancellation locks navigation until the worker has stopped.
  Bookmarks and refresh select a tool but never restore a draft.
- Tool settings live in a dedicated right sidebar, toggled from the right end of
  the breadcrumb header. Wide screens dock the independently scrolling panel;
  narrower screens open it as a drawer. Closing it preserves settings. Generation,
  cancellation, preservation acknowledgement, and downloads stay with the documents.
- Inputs come before settings in reading/tab order. Dragging is optional; keyboard ordering,
  removal, focus restoration, and status announcements remain available.
- `apps/web/src/workspace` owns the file registry, required PDF/image validation queue,
  windowed inputs, preview cache, document job lifecycle, and output/download
  ownership. All three tools share one draft/job owner and download lifecycle;
  PDF tools additionally share preservation acknowledgement. Each feature supplies its operation and settings.
  `core-ui` owns the reusable file dropzone and dialog.
- Shared downloads retain only metadata in React state and keep Blob references
  in the output store. A single output downloads directly as PDF. Multiple outputs
  expose individual downloads plus **Prepare ZIP for all PDFs**, followed by an
  explicit **Download ZIP**. No download starts just because packaging finished.
  Split and separate-image conversion use these multi-output controls; merge still produces exactly one PDF.
- ZIP packaging uses a separate, lazy fflate worker. Cancellation terminates it
  before unlocking, without discarding generated PDFs. Packaging/download errors
  permit explicit retry; editing/reset releases output and ZIP URLs. Filenames are
  sanitized and disambiguated once, so individual names and ZIP entries agree.
- The shared preview queue accepts separate lazy PDF and JPEG/PNG renderers.
  Optional image thumbnails run in a disposable local worker, fit within 144 pixels,
  and never modify originals. Required image decoding and conversion have a separate
  disposable worker; optional previews never establish export support.
- The footer opens local `privacy.html` and `notices.html` disclosures in a new tab
  without discarding work. The notices page explicitly records incomplete release
  licensing, rather than claiming a completed compliance audit.

`PdfLimits`, `ImageLimits`, `BundleLimits`, and `ImagePreviewLimits` are enforcement points for
measured release values, not prepopulated production limits. The registry and
output store report retained raw bytes/counts; ZIP progress reports actual entries
and packaging bytes. These are not measurements of total browser/decoded memory.
Image header dimensions and aggregate pixel budgets are checked before generation
decoding; decoded dimensions are checked again. These checks do not guarantee
against decoder allocation failure. Physical-device calibration and measured
production thresholds remain release work.

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
- File cards use shared shadcn Attachment components with uncropped page previews.
  Queued, rendering, paused, and failed previews have distinct feedback.
  **Retry preview** queues only that thumbnail without restarting an in-flight
  preview or changing validation, input order, or acknowledgement. Validation
  retry remains a separate action.
- PDF.js image decoders for JBIG2/CCITT scans and JPEG 2000 are shipped locally
  with their license texts in `assets/pdfjs/`, in both development and production.
  The no-WebAssembly preview mode still requires these JavaScript decoder assets;
  omitting them can produce blank thumbnails for otherwise valid scanned PDFs.
- One required validation and one optional preview run at a time. Eight inputs
  are displayed per view; only that view's thumbnails are retained. This UI bound
  is not a measured workload limit or virtualization threshold. Drop an input on
  **Previous files** or **Next files** to move it to the adjacent view's nearest
  position; repeat to move farther. Navigation happens on drop, not while hovering,
  so the native drag source stays mounted. Move up/down also works across views.
- Generation pauses previews and locks editing. Cancel stops its disposable
  worker, then restores the unchanged draft. No elapsed-time generation cutoff
  or automatic retry is used.
- Spinner indicates indeterminate validation, rendering, startup, and saving;
  page-copy Progress uses the complete validated page count, not a per-input
  percentage. Shared ZIP progress counts packaged PDFs. Reduced motion retains
  static loading indicators and status text.
- Sonner announces successful generation and download requests, not every file
  or reorder. Actionable errors and cancellation status remain inline. A download
  request does not prove that the browser saved the file.
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

## Split / Extract behavior

Open `#/split` and add exactly one source PDF. Multi-file drops are rejected, not
silently reduced to the first file. Required validation and preservation acknowledgement
are the same as merge; unsupported inputs cannot be acknowledged into support.
Remove the source or start over to choose another PDF.

- **Selected pages:** toggle numbered pages, Select all, or Clear. Pages are unique
  and exported in the arranged thumbnail order, initially source order, regardless of click order.
  Use drag handles (mouse, press-and-hold touch, or keyboard), Earlier/Later, or Reset page order.
  Unselecting a page does not reset its position. Ordering applies only to selected-page
  extraction; other modes keep their existing rules. Eight source pages and
  their optional previews are shown at a time; moving between views preserves selections.
  A preview failure does not block validation or generation.
  Failed page previews can be retried without changing the selection or arrangement.
  Drop on Previous/Next pages or use Earlier/Later to reorder across views.
  Dragging uses the maintained `@dnd-kit/react` 0.5.0 package, with native checkbox
  controls kept separate from drag handles.
- **Custom ranges:** add inclusive Start/End page rows and order them with Move up/down.
  Combine ranges into one PDF (default), or create one PDF per row. Overlaps and
  repeated rows intentionally repeat pages, with a visible warning.
- **Fixed page-count groups:** choose a whole number from 1 through the source page
  count. Consecutive groups retain a shorter final group.
- **Every page:** create one PDF per source page, in source order.

Bounded numeric controls have no comma-separated expression grammar. Incomplete,
reversed, fractional and out-of-bounds settings disable generation and remove the
previous prediction; inline guidance explains what to correct. The React-free selection
planner validates again in the generation worker. Before processing, it supplies exact
output counts, filenames and page counts, including repetitions. Predictions and output
downloads are windowed to eight entries without limiting the number of outputs.

Combined selections use `<source>-extracted.pdf`; separate outputs use
`<source>-split-001.pdf`, with indexes expanding beyond three digits. A single split
output retains its numbered name and downloads directly, without a ZIP. Multiple outputs
offer individual PDFs plus an explicitly prepared `<source>-split.zip`; ZIP entries match
individual filenames. Sanitization and collision handling follow the shared download rules.
Leading dots and spaces are stripped from source stems before predicting or generating filenames.
Reserved device stems such as `CON.foo` are prefixed with `_`. Planning, generation, PDF downloads,
and ZIP naming share the same sanitizer so retention does not change predicted names.

Generation is a lazy local worker and rewrites pages without rasterizing them. Cancellation
terminates the worker and retains source/settings; a failed job never publishes partial outputs.
Editing clears generated outputs, with confirmation when downloads remain unrequested.
Changing tools, removing the source or resetting cannot carry selections into another document.
`PdfLimits` can enforce selected-page totals (including repetitions), output count and aggregate
output bytes. The split page limit applies to selected output pages, not the source's full page
count; source byte limits and full structural validation still apply.
These are calibration hooks, not measured production limits. No size-target
splitting, compression, repair, encrypted-PDF support, or remote fallback is added.

## Images to PDF behavior

Open `#/images` and add static JPEG or PNG files. Content inspection and required
worker decoding determine support, not the extension or MIME label. Valid
mislabeled images show a format-mismatch notice; unsupported content, corrupt or
undecodable images, invalid dimensions, and animated PNGs remain visible and
block generation until retried successfully or removed. Animated PNGs must be
exported as a still image externally; no frame is silently selected.
PNG chunk checksums, the compressed pixel stream, scanline lengths/filters
(including interlacing), and JPEG end markers are checked rather than trusting
permissive browser decoding to detect truncation. PNG integrity checking requires
local decompression-stream support; missing capabilities fail explicitly.

- Each input produces one page in displayed file order. Reorder with Move up/down
  or drag, including across the eight-item input windows. Rotate left/right in
  90-degree steps after EXIF orientation correction, including mirrored EXIF variants.
  Thumbnails show the corrected image and manual rotation, not a paper-layout proof.
- Defaults are one combined PDF, A4, Auto orientation per image, and 10 mm margins.
  Letter, Portrait/Landscape overrides, and 0/20 mm margins are also available.
  Auto uses landscape only when the corrected/rotated image is wider than tall.
  Images are centered and fit fully with equal margins: no clipping or stretching.
  Small images may be enlarged for placement, which does not manufacture detail.
- Image size makes pages at exactly 96 pixels per inch (0.75 PDF points per pixel).
  It ignores embedded DPI, margins, and orientation overrides. Rotation swaps page
  dimensions. Large inputs may create physically large pages.
- The worker decodes one image at a time, composites transparency onto white, and
  normalizes the corrected/rotated browser pixels to lossless PNG at native pixel
  dimensions before embedding. JPEG inputs are not lossily recompressed, but are
  not retained as original JPEG streams; resulting PDFs may be substantially larger.
  There is no downsampling or compression fallback. This is not a guarantee of
  universal color-profile, bit-depth, or metadata preservation.
- Combined output is `<first-image-stem>-images.pdf`. Separate output uses
  `<image-stem>-converted.pdf` with the shared sanitizer and deterministic collision
  suffixes. Multiple outputs use an explicitly prepared `<first-image-stem>-images.zip`
  whose entries match individual filenames. A single separate output retains its
  `-converted.pdf` name and downloads directly without a ZIP.
- Conversion locks editing and stops optional previews. Cancel terminates the
  worker before unlocking and retains images, ordering, rotations, and settings.
  Failures never publish partial PDFs. Edit/reset/navigation use shared safe
  confirmations; reset releases originals, previews, outputs, and ZIP resources
  and restores default image settings. Nothing downloads automatically.
- `ImageLimits` supports input counts/bytes, per-image and total decoded pixels,
  maximum pixel dimension, output page dimensions in points, and output counts/bytes.
  Passed limits are checked before expensive work where possible and fail with
  actionable errors rather than resizing. Production numeric values remain
  uncalibrated; large images can still exhaust browser memory.

Browser coverage inspects real PDF page/placement geometry, all eight EXIF
variants and every manual quarter-turn, mirrored content, transparency, embedded
300-DPI metadata, tiny and tall/wide images, and native embedded RGB bytes against
browser-decoded pixels. It also covers combined/separate PDF and ZIP naming,
failures, cancellation, explicit downloads, and 20 reset cycles with worker/URL
cleanup. Chromium, Firefox, WebKit, and mobile emulation are evidence for those
test builds, not the required physical-device or current/previous-major matrix.
No HEIC, WebP, TIFF, animated PNG, collage, free-angle rotation, custom margin,
or background-color support is added.

## Repository guide

**[CODING_STANDARDS.md](CODING_STANDARDS.md)** owns coding conventions: focused
modules, descriptive arrow functions, minimal comments, package entry barrels,
React/shadcn practices, dependency boundaries, formatting, and lint rules.
Components use PascalCase `.tsx` filenames; other project-owned JS/TS sources,
tests, and build scripts use camelCase, enforced by lint. Conventional config
names and dotted test/worker suffixes are retained.

| Package               | Responsibility                                                                    |
| --------------------- | --------------------------------------------------------------------------------- |
| `apps/web`            | React app, shared workspace, merge/split/image views and hooks, and build scripts |
| `packages/core-ui`    | Shared shadcn primitives, reusable compositions, utilities, and theme             |
| `packages/pdf-engine` | React-free PDF/image validation/generation, previews, ZIP packaging, and workers  |
| `packages/tooling`    | Shared TypeScript, ESLint, and formatter tooling                                  |

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
Synthetic six-page JBIG2 and CCITT scan fixtures also check actual thumbnail
pixels and same-origin decoder loading in production and development; no user
documents are included in the fixture set.
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

Split checks cover every approved mode, arranged selected pages, ordered/repeated ranges, exact predictions,
single-page sources, invalid settings, cancellation, source rejection, and repeated
PDF/ZIP/reset cycles. PDF.js independently compares downloaded text, geometry and
every rendered page with the source, including repeated pages. Unit checks also
generate 1,001 separately named PDFs and verify their ZIP entries. These synthetic
cases do not replace the release fixture/device matrix or measured memory limits.
Page ordering checks exercise pointer and keyboard drag/drop, Escape cancellation,
touch handles, cross-window moves, selection persistence, and reset, including the
page order inside downloaded PDFs.

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

Releases: read [RELEASING.md](RELEASING.md) before tagging or changing GitHub Pages
delivery. It owns candidate qualification, owner approval, and publication verification.

No backend, analytics, document persistence, or Office engine is included.
On-device processing is the primary product promise; it does not
imply offline availability or an absence of hosting requests. Licensing, privacy,
and owner approval for every release commit are governed by
[Decide licensing, privacy claims, and release readiness](https://github.com/chiItepin/pdfburrow/issues/7).
