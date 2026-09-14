# PDFBurrow

PDFBurrow processes documents on the user's device to produce downloadable PDFs.

## Language

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
The source pages chosen for an output. Selected-page toggles choose unique pages in source order; custom ranges preserve range order and can repeat pages where ranges overlap.

**Page range**:
A contiguous, inclusive span from a start page to an end page in one source PDF, numbered from 1.

**Fixed page-count group**:
A consecutive group of source pages with the requested number of pages, except that the final group may be shorter.

**Image-sized page**:
A PDF page whose dimensions follow its image rather than a fixed paper size.

**Digital signature**:
A cryptographic signature associated with a PDF that can establish signer identity and whether signed content has changed. A drawn or scanned signature on a page is not a digital signature.
