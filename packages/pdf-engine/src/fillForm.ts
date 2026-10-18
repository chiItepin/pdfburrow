import { PDFHexString, PDFName } from "pdf-lib";
import { loadValidatedPdf, enforceLimit } from "./pdf.ts";
import { describeFormFields } from "./inspectFillableForm.ts";
import { setPdfCheckBoxValue } from "./pdfCheckBoxValues.ts";
import { inspectMarkupAnnotations, markupGeometry } from "./markupGeometry.ts";
import { updatePdfFieldAppearances } from "./pdfFieldAppearances.ts";
import { PdfError } from "./pdfError.ts";
import { pdfStem } from "./pdfFilename.ts";
import type { FillFormRequest, FormInfo, FormValue } from "./formTypes.ts";
import type { PdfInput, PdfLimits, PdfOutput, PdfProgress } from "./types";

const prepare = async (input: PdfInput, limits: PdfLimits) => {
  const { document, info } = await loadValidatedPdf(input, limits, "fill");
  try {
    const fields = describeFormFields(document);
    return {
      document,
      info: {
        ...info,
        fields,
        formPages: document.getPages().map(markupGeometry),
        warnings: [
          ...info.warnings,
          "Supported fields remain editable unless you explicitly flatten a copy for visual signing.",
        ],
      } satisfies FormInfo,
    };
  } catch (error) {
    if (error instanceof PdfError) {
      throw error;
    }
    throw new PdfError(
      "unsupported",
      "This form's fields, text encoding or appearances cannot be filled safely. Use a newly exported standard AcroForm PDF.",
    );
  }
};

export const inspectFillablePdf = async (
  input: PdfInput,
  limits: PdfLimits = {},
): Promise<FormInfo> => (await prepare(input, limits)).info;

export const fillPdfForm = async (
  request: FillFormRequest,
  progress: (value: PdfProgress) => void,
): Promise<PdfOutput> => {
  if (!request.acknowledged) {
    throw new PdfError(
      "invalid",
      "Review and acknowledge the form preservation limitations first.",
    );
  }
  progress({ phase: "validating", completed: 0, total: 1 });
  const { document, info } = await prepare(request.input, request.limits ?? {});
  const values = new Map<string, FormValue["value"]>();
  for (const entry of request.values) {
    if (values.has(entry.name) || !info.fields.some((field) => field.name === entry.name)) {
      throw new PdfError("invalid", "The submitted form fields do not match the source PDF.");
    }
    values.set(entry.name, entry.value);
  }
  if (values.size !== info.fields.length) {
    throw new PdfError("invalid", "Some form values are missing. Retry with the complete form.");
  }
  const form = document.getForm();
  for (const field of info.fields) {
    const value = values.get(field.name);
    const invalid = (message: string): never => {
      throw new PdfError("invalid", `${field.label}: ${message}`);
    };
    if (field.readOnly && value !== field.value) {
      invalid("this field is read-only.");
    }
    if (field.kind === "checkbox") {
      if (typeof value !== "boolean") {
        invalid("choose a checked or unchecked value.");
      }
      const checkbox = form.getCheckBox(field.name);
      if (value) {
        checkbox.check();
      } else {
        checkbox.uncheck();
      }
    } else if (field.kind === "checkbox-group") {
      if (typeof value !== "string" || (value && !field.options.includes(value))) {
        invalid("choose an existing checkbox option.");
        continue;
      }
      setPdfCheckBoxValue(form.getCheckBox(field.name), value);
    } else {
      if (typeof value !== "string") {
        invalid("enter a text value.");
        continue;
      }
      if (field.kind === "text") {
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          invalid(`use at most ${field.maxLength} characters.`);
        }
        if (
          (!field.multiline && /[\r\n]/.test(value)) ||
          [...value].some((character) => {
            const code = character.charCodeAt(0);
            return (code < 32 && code !== 10 && code !== 13) || code === 127;
          })
        ) {
          invalid("unsupported control characters; use plain text.");
        }
        try {
          form.getDefaultFont().encodeText(value.replace(/[\r\n]/g, ""));
        } catch {
          invalid(
            "this character is not supported by the local form font. Use Western European text.",
          );
        }
        form.getTextField(field.name).setText(value);
      } else if (field.kind === "radio") {
        if (value && !field.options.includes(value)) {
          invalid("choose an existing radio option.");
        }
        const radio = form.getRadioGroup(field.name);
        if (value) {
          radio.select(value);
        } else {
          radio.clear();
        }
      } else {
        if (value && !field.options.some((option) => option.value === value)) {
          invalid("choose an existing dropdown option.");
        }
        const dropdown = form.getDropdown(field.name);
        if (value) {
          // pdf-lib validates display labels, not export values, in setValues/select.
          dropdown.acroField.dict.set(PDFName.of("V"), PDFHexString.fromText(value));
          dropdown.acroField.dict.delete(PDFName.of("I"));
        } else {
          dropdown.clear();
        }
      }
    }
  }
  updatePdfFieldAppearances(document);
  if (request.flatten) {
    form.flatten({ updateFieldAppearances: false });
    // pdf-lib leaves dangling widget references. Preflight permits only the widgets just flattened.
    for (const page of document.getPages()) {
      page.node.delete(PDFName.of("Annots"));
    }
    inspectMarkupAnnotations(document);
  }
  progress({ phase: "saving", completed: 1, total: 1 });
  const bytes = await document.save({ updateFieldAppearances: false });
  enforceLimit(
    bytes.byteLength,
    request.limits?.outputBytes,
    "Output bytes",
    "Use a smaller form.",
  );
  if (request.flatten) {
    enforceLimit(
      bytes.byteLength,
      request.limits?.perInputBytes,
      "Signature editor input bytes",
      "Use a smaller form before continuing to visual signing.",
    );
  }
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    suggestedFilename: `${pdfStem(request.input.name)}-${request.flatten ? "ready-to-sign" : "filled"}.pdf`,
  };
};
