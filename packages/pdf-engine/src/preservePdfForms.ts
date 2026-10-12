import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFStream,
  PDFTextField,
} from "pdf-lib";
import type { PDFObject, PDFRef } from "pdf-lib";
import { copyPdfPages } from "./copyPdfPages.ts";
import { pdfButtonOption, preservePdfButtonState } from "./pdfButtonFields.ts";
import {
  assertMatchingFieldAttributes,
  describePdfField,
  inheritedFieldKeys,
} from "./pdfFormFields.ts";
import { inspectPageReferences } from "./inspectPageReferences.ts";
import { PdfError } from "./pdfError.ts";
import { appendPdfField } from "./pdfFieldTree.ts";
import { createPdfFieldNames } from "./pdfFieldNames.ts";

const assertNoFormActions = (source: PDFDocument) => {
  const pending: PDFObject[] = source.context
    .enumerateIndirectObjects()
    .map(([, object]) => object);
  pending.push(source.catalog);
  const visited = new Set<PDFObject>();
  while (pending.length) {
    const reference = pending.pop();
    const object = source.context.lookup(reference);
    if (!object || visited.has(object)) {
      continue;
    }
    visited.add(object);
    if (object instanceof PDFDict) {
      if (
        ["/JavaScript", "/ResetForm", "/SubmitForm", "/ImportData", "/Hide"].includes(
          object.lookup(PDFName.of("S"))?.toString() ?? "",
        )
      ) {
        throw new PdfError(
          "unsupported",
          "Scripted form behavior cannot be preserved safely. No flattened substitute will be generated.",
        );
      }
      for (const [, value] of object.entries()) {
        pending.push(value);
      }
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) {
        pending.push(value);
      }
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
    }
  }
};

export const preservePdfForms = async (source: PDFDocument): Promise<PDFDocument> => {
  inspectPageReferences(source);
  assertNoFormActions(source);
  const originalForm = source.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (originalForm?.lookupMaybe(PDFName.of("CO"), PDFArray)?.size()) {
    throw new PdfError(
      "unsupported",
      "Calculated form behavior cannot be preserved safely. No flattened substitute will be generated.",
    );
  }
  const fields = new Map<
    PDFDict,
    { dict: PDFDict; original: PDFDict; ref: PDFRef; options: PDFObject[]; name: string }
  >();
  const names = createPdfFieldNames();
  for (const page of source.getPages()) {
    const annotations: PDFObject[] = [];
    for (const reference of page.node.Annots()?.asArray() ?? []) {
      const widget = source.context.lookup(reference, PDFDict);
      if (widget.lookup(PDFName.of("Subtype"))?.toString() !== "/Widget") {
        annotations.push(reference);
        continue;
      }
      const description = describePdfField(widget, source);
      let field = fields.get(description.owner);
      if (!field) {
        if (names.conflicts(description.name)) {
          throw new PdfError(
            "unsupported",
            "Distinct source fields have the same name and cannot be preserved safely.",
          );
        }
        names.add(description.name);
        field = {
          dict: description.field,
          original: description.field.clone(),
          ref: source.context.register(description.field),
          options: [],
          name: description.name,
        };
        field.dict.set(PDFName.of("Kids"), source.context.obj([]));
        fields.set(description.owner, field);
      } else {
        assertMatchingFieldAttributes(field.original, description.field);
      }
      const appearance = widget.clone();
      for (const key of [...inheritedFieldKeys, "T", "Kids", "DS", "RV", "StructParent"]) {
        appearance.delete(PDFName.of(key));
      }
      appearance.set(PDFName.of("Parent"), field.ref);
      appearance.set(PDFName.of("P"), page.ref);
      const widgetRef = source.context.register(appearance);
      field.dict.lookup(PDFName.of("Kids"), PDFArray).push(widgetRef);
      annotations.push(widgetRef);
      preservePdfButtonState(field.original, field.dict, widget);
      const option = pdfButtonOption(description.field, description.owner, widget, source);
      if (option) {
        field.options.push(option);
      }
    }
    if (annotations.length) {
      page.node.set(PDFName.of("Annots"), source.context.obj(annotations));
    }
  }
  if (!fields.size) {
    throw new PdfError(
      "unsupported",
      "Form fields cannot be associated with source pages. No flattened substitute will be generated.",
    );
  }
  const acroForm = source.context.obj({ Fields: [] });
  for (const field of fields.values()) {
    appendPdfField(source, acroForm, field.dict, field.ref, field.name);
  }
  source.catalog.set(PDFName.of("AcroForm"), acroForm);
  const form = source.getForm();
  const font = form.getDefaultFont();
  acroForm.set(PDFName.of("DR"), source.context.obj({ Font: { [font.name]: font.ref } }));
  for (const entry of fields.values()) {
    if (entry.options.length) {
      entry.dict.set(PDFName.of("Opt"), source.context.obj(entry.options));
    }
  }
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField || field instanceof PDFDropdown) {
      field.acroField.setDefaultAppearance(
        `${field.acroField.getDefaultAppearance() ?? ""}\n/${font.name} 0 Tf`,
      );
    }
    // Refresh appearances without changing /V or the field's editability and option values.
    if (field instanceof PDFDropdown) {
      const value = field.acroField.dict.get(PDFName.of("V"));
      const selected = field.getSelected();
      const option = field.acroField
        .getOptions()
        .find((item) => item.value.decodeText() === selected[0]);
      try {
        if (option?.display) {
          field.acroField.dict.set(
            PDFName.of("V"),
            PDFHexString.fromText(option.display.decodeText()),
          );
        }
        field.defaultUpdateAppearances(font);
      } finally {
        if (value) {
          field.acroField.dict.set(PDFName.of("V"), value);
        } else {
          field.acroField.dict.delete(PDFName.of("V"));
        }
      }
    } else {
      field.defaultUpdateAppearances(font);
    }
  }
  await source.flush();
  const document = await PDFDocument.create();
  for (const page of await copyPdfPages(source, document, source.getPageIndices())) {
    document.addPage(page);
  }
  return document;
};
