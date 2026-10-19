import {
  PDFCheckBox,
  PDFDict,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
} from "pdf-lib";
import type { PDFDocument, PDFField } from "pdf-lib";
import { markupGeometry } from "./markupGeometry.ts";
import { describePdfField } from "./pdfFormFields.ts";
import { describePdfCheckBox } from "./pdfCheckBoxValues.ts";
import { PdfError } from "./pdfError.ts";
import type { FormField, FormWidget } from "./formTypes.ts";

const unsupported = (message: string): never => {
  throw new PdfError(
    "unsupported",
    `${message} Use a standard AcroForm copy without these features.`,
  );
};

export const inspectFormForFilling = (document: PDFDocument) => {
  const fields = document.getForm().getFields();
  if (!fields.length) {
    unsupported(
      "No supported fillable fields were found. For a flat form, use Sign & annotate PDF.",
    );
  }
  if (fields.length > 500) {
    unsupported("This form exceeds the provisional 500-field limit.");
  }
  const widgets = new Set<PDFDict>();
  for (const page of document.getPages()) {
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const widget = document.context.lookup(ref, PDFDict);
      if (widget.lookup(PDFName.of("Subtype"))?.toString() !== "/Widget") {
        unsupported(
          "Forms with additional annotations or links are not supported for filling yet.",
        );
      }
      describePdfField(widget, document);
      if (widgets.has(widget)) {
        unsupported("A form widget is assigned to more than one page.");
      }
      widgets.add(widget);
    }
  }
  if (widgets.size > 1000) {
    unsupported("This form exceeds the provisional 1,000-widget limit.");
  }
  const assigned = new Set<PDFDict>();
  for (const field of fields) {
    if (!field.acroField.getWidgets().length) {
      unsupported("Fields without visible page controls cannot be filled safely.");
    }
    for (const widget of field.acroField.getWidgets()) {
      if (!widgets.has(widget.dict) || assigned.has(widget.dict)) {
        unsupported("The form field tree and page controls do not agree.");
      }
      assigned.add(widget.dict);
      const flags = widget.getFlags();
      if (flags & (1 | 2 | 32) || !(flags & 4)) {
        unsupported("Hidden or nonprinting form controls are not supported for filling.");
      }
      if (widget.getAppearanceCharacteristics()?.getRotation()) {
        unsupported("Individually rotated form controls are not supported for filling.");
      }
    }
    if (field instanceof PDFTextField && (field.isFileSelector() || field.isRichFormatted())) {
      unsupported("File-selection and rich-text fields are not supported.");
    }
    if (field instanceof PDFDropdown && field.isEditable()) {
      unsupported("Dropdowns that accept custom options are not supported yet.");
    }
  }
  if (assigned.size !== widgets.size) {
    unsupported("Some page controls are missing from the form field tree.");
  }
};

const describeWidgets = (field: PDFField, document: PDFDocument): FormWidget[] => {
  const options =
    field instanceof PDFRadioGroup
      ? field.getOptions()
      : field instanceof PDFCheckBox
        ? describePdfCheckBox(field).widgetOptions
        : [];
  return field.acroField.getWidgets().map((widget, index) => {
    const pageIndex = document.getPages().findIndex((page) =>
      page.node
        .Annots()
        ?.asArray()
        .some((ref) => document.context.lookup(ref) === widget.dict),
    );
    const page = document.getPages()[pageIndex];
    if (!page) {
      return unsupported("A field cannot be located on a page.");
    }
    const geometry = markupGeometry(page);
    const rect = widget.getRectangle();
    const [a, b, c, d, e, f] = geometry.transform;
    const x = a * (rect.x + rect.width / 2) + c * (rect.y + rect.height / 2) + e;
    const y = b * (rect.x + rect.width / 2) + d * (rect.y + rect.height / 2) + f;
    const unit = Math.hypot(a, b);
    const width = rect.width * unit;
    const height = rect.height * unit;
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const halfWidth = (rotation % 180 ? height : width) / 2;
    const halfHeight = (rotation % 180 ? width : height) / 2;
    if (
      x - halfWidth < 0 ||
      y - halfHeight < 0 ||
      x + halfWidth > geometry.width ||
      y + halfHeight > geometry.height
    ) {
      return unsupported("A form control extends outside the visible page.");
    }
    return { page: pageIndex + 1, x, y, width, height, rotation, option: options[index] };
  });
};

export const describeFormFields = (document: PDFDocument): FormField[] =>
  document
    .getForm()
    .getFields()
    .map((field): FormField => {
      const tooltip = field.acroField.dict.lookup(PDFName.of("TU"));
      const details = {
        name: field.getName(),
        label:
          tooltip instanceof PDFString || tooltip instanceof PDFHexString
            ? tooltip.decodeText() || field.getName()
            : field.getName(),
        readOnly: field.isReadOnly(),
        required: field.isRequired(),
        widgets: describeWidgets(field, document),
      };
      if (field instanceof PDFTextField) {
        return {
          ...details,
          kind: "text",
          value: field.getText() ?? "",
          multiline: field.isMultiline(),
          maxLength: field.getMaxLength(),
        };
      }
      if (field instanceof PDFCheckBox) {
        const { options, value } = describePdfCheckBox(field);
        return options.length === 1
          ? { ...details, kind: "checkbox", value: Boolean(value) }
          : { ...details, kind: "checkbox-group", options, value };
      }
      if (field instanceof PDFRadioGroup) {
        const options = field.getOptions();
        const value = field.getSelected() ?? "";
        if (
          options.length !== details.widgets.length ||
          options.some((option) => !option) ||
          (value && !options.includes(value))
        ) {
          return unsupported("Radio controls have inconsistent options or values.");
        }
        return { ...details, kind: "radio", options, value };
      }
      if (field instanceof PDFDropdown) {
        const options = field.acroField.getOptions().map((option) => ({
          value: option.value.decodeText(),
          label: (option.display ?? option.value).decodeText(),
        }));
        const values = field.getSelected();
        if (
          !options.length ||
          options.some((option) => !option.value) ||
          new Set(options.map((option) => option.value)).size !== options.length ||
          values.length > 1 ||
          (values[0] && !options.some((option) => option.value === values[0]))
        ) {
          return unsupported("Dropdown controls have inconsistent options or values.");
        }
        return { ...details, kind: "dropdown", options, value: values[0] ?? "" };
      }
      return unsupported("This form contains unsupported field types.");
    });
