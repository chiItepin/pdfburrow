import { PDFArray, PDFDict, PDFName, PDFObjectCopier, PDFPage } from "pdf-lib";
import type { PDFDocument, PDFObject, PDFRef } from "pdf-lib";
import { pdfButtonOption } from "./pdfButtonFields.ts";
import { appendPdfField, pdfFieldName } from "./pdfFieldTree.ts";
import { createPdfFieldNames } from "./pdfFieldNames.ts";

export const copyPdfPages = async (
  source: PDFDocument,
  output: PDFDocument,
  indices: readonly number[],
): Promise<PDFPage[]> => {
  if (!source.catalog.has(PDFName.of("AcroForm"))) {
    return output.copyPages(source, [...indices]);
  }
  const copier = PDFObjectCopier.for(source.context, output.context);
  const originalForm = source.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  const form =
    output.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict) ??
    output.context.obj({ Fields: [] });
  const roots = form.lookup(PDFName.of("Fields"), PDFArray);
  const names = createPdfFieldNames();
  const pending = roots.asArray();
  while (pending.length) {
    const ref = pending.pop();
    if (!ref) {
      continue;
    }
    const field = output.context.lookup(ref, PDFDict);
    if (field.has(PDFName.of("FT"))) {
      names.add(pdfFieldName(field));
    } else {
      for (const child of field.lookup(PDFName.of("Kids"), PDFArray).asArray()) {
        pending.push(child);
      }
    }
  }
  const fields = new Map<PDFDict, { dict: PDFDict; ref: PDFRef; options: PDFObject[] }>();
  const pages: PDFPage[] = [];
  for (const index of indices) {
    const original = source.getPage(index);
    const node = original.node.clone();
    node.delete(PDFName.of("Annots"));
    const copied = copier.copy(node);
    const pageRef = output.context.register(copied);
    const annotations: PDFObject[] = [];
    for (const annotationRef of original.node.Annots()?.asArray() ?? []) {
      const annotation = source.context.lookup(annotationRef, PDFDict);
      const widget = annotation.clone();
      widget.delete(PDFName.of("P"));
      if (annotation.lookup(PDFName.of("Subtype"))?.toString() === "/Widget") {
        const owner = annotation.lookup(PDFName.of("Parent"), PDFDict);
        let target = fields.get(owner);
        if (!target) {
          const name = names.available(pdfFieldName(owner));
          const field = owner.clone();
          field.delete(PDFName.of("Kids"));
          field.delete(PDFName.of("Parent"));
          const dict = copier.copy(field);
          dict.set(PDFName.of("Kids"), output.context.obj([]));
          target = { dict, ref: output.context.register(dict), options: [] };
          fields.set(owner, target);
          appendPdfField(output, form, dict, target.ref, name);
        }
        widget.delete(PDFName.of("Parent"));
        const dict = copier.copy(widget);
        dict.set(PDFName.of("Parent"), target.ref);
        dict.set(PDFName.of("P"), pageRef);
        const ref = output.context.register(dict);
        annotations.push(ref);
        target.dict.lookup(PDFName.of("Kids"), PDFArray).push(ref);
        const option = pdfButtonOption(owner, owner, annotation, source);
        if (option) {
          target.options.push(copier.copy(option));
          target.dict.set(PDFName.of("Opt"), output.context.obj(target.options));
        }
      } else {
        const dict = copier.copy(widget);
        dict.set(PDFName.of("P"), pageRef);
        annotations.push(output.context.register(dict));
      }
    }
    if (annotations.length) {
      copied.set(PDFName.of("Annots"), output.context.obj(annotations));
    }
    pages.push(PDFPage.of(copied, pageRef, output));
  }
  if (fields.size) {
    // Normalized fields all use the same standard font; their appearance streams keep local resources.
    const resources = originalForm.get(PDFName.of("DR"));
    if (resources) {
      form.set(PDFName.of("DR"), copier.copy(resources));
    }
    output.catalog.set(PDFName.of("AcroForm"), form);
  }
  return pages;
};
