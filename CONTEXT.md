# PDFBurrow

PDFBurrow processes documents on the user's device to produce downloadable PDFs.

## Language

**On-device processing**:
Document work performed on the user's device without PDFBurrow uploading inputs, filenames, previews, or outputs. This does not imply offline availability or an absence of website-hosting requests.

**Input**:
An original document or image supplied by the user for processing.

**Output**:
A generated PDF produced from the user's inputs and selected operation.

**Job**:
One requested document operation that produces one or more outputs. A job is not the entire editing session.

**Draft**:
The inputs and operation settings the user is preparing for the selected tool. A draft is not a running job or a generated output.

**Download bundle**:
A ZIP containing multiple outputs for download together.

**Page selection**:
The source pages chosen for an output. Selected-page toggles choose unique pages in the user's arranged page order, initially source order; custom ranges preserve range order and can repeat pages where ranges overlap.

**Page range**:
A contiguous, inclusive span from a start page to an end page in one source PDF, numbered from 1.

**Fixed page-count group**:
A consecutive group of source pages with the requested number of pages, except that the final group may be shorter.

**Image-sized page**:
A PDF page whose dimensions follow its image rather than a fixed paper size.

**Markup**:
A user-added overlay on a PDF page: freehand ink, a rectangular highlight, a text note, or a visual signature. Editing markup does not mean editing the PDF's original text or pre-existing annotations.
_Avoid_: Marker

**Markup object**:
One independently editable piece of markup: a single ink stroke, a rectangular highlight, a text note, or an entire visual signature. A visual signature can contain multiple strokes while remaining one object.

**Text note**:
User-added text visibly placed on a PDF page, not a comment icon or pop-up. A note can contain multiple lines and has no border or background.

**Visual signature**:
A visible representation of a person's signature placed on a PDF page. It is markup, not a cryptographic signature or proof of signer identity.

**Digital signature**:
A cryptographic signature associated with a PDF that can establish signer identity and whether signed content has changed. A drawn or scanned signature on a page is not a digital signature.
