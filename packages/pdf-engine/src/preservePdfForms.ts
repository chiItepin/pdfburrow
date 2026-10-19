import { PDFAcroTerminal, PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";
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
import { updatePdfFieldAppearances } from "./pdfFieldAppearances.ts";

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

export const preservePdfForms = async (
  source: PDFDocument,
  requireVisibleFields = false,
): Promise<PDFDocument> => {
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
  const widgets = new Set<PDFDict>();
  for (const page of source.getPages()) {
    const annotations: PDFObject[] = [];
    for (const reference of page.node.Annots()?.asArray() ?? []) {
      const widget = source.context.lookup(reference, PDFDict);
      if (widget.lookup(PDFName.of("Subtype"))?.toString() !== "/Widget") {
        annotations.push(reference);
        continue;
      }
      if (widgets.has(widget)) {
        throw new PdfError(
          "invalid",
          "A form widget is assigned to more than one page or control.",
        );
      }
      widgets.add(widget);
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
  if (requireVisibleFields) {
    const visibleNames = new Set([...fields.values()].map((field) => field.name));
    for (const [field] of source.catalog.getAcroForm()?.getAllFields() ?? []) {
      if (
        field instanceof PDFAcroTerminal &&
        !visibleNames.has(field.getFullyQualifiedName() ?? "")
      ) {
        throw new PdfError(
          "unsupported",
          "Fields without visible page controls cannot be filled safely. Use a standard AcroForm copy without these features.",
        );
      }
    }
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
  updatePdfFieldAppearances(source);
  await source.flush();
  const document = await PDFDocument.create();
  for (const page of await copyPdfPages(source, document, source.getPageIndices())) {
    document.addPage(page);
  }
  return document;
};
