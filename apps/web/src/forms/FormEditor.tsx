import { useState } from "react";
import { Button, Label, NativeSelect, NativeSelectOption } from "@repo/core-ui";
import type { FormInfo, PdfOutput } from "@repo/pdf-engine";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { pdfLimits } from "../workspace/resourcePolicy";
import { FormFields } from "./FormFields";
import { FormPage } from "./FormPage";
import { FormOutput } from "./FormOutput";

export const FormEditor = ({
  file,
  info,
  workspace,
  onSign,
}: {
  file: File;
  info: FormInfo;
  workspace: ReturnType<typeof useDocumentWorkspace>;
  onSign: (output: PdfOutput) => boolean;
}) => {
  const [values, setValues] = useState(() =>
    info.fields.map(({ name, value }) => ({ name, value })),
  );
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"page" | "list">("page");
  const [zoom, setZoom] = useState(1);
  const [flattened, setFlattened] = useState(false);
  const { execution, draft } = workspace;
  const onChange = (name: string, value: string | boolean) => {
    if (!execution.editable) {
      return;
    }
    execution.editDraft();
    setValues((current) => current.map((entry) => (entry.name === name ? { name, value } : entry)));
  };
  const missing = info.fields.filter(
    (field) => field.required && !values.find((entry) => entry.name === field.name)?.value,
  ).length;
  const generate = (flatten: boolean) => {
    if (!execution.editable || !draft.acknowledged) {
      return;
    }
    setFlattened(flatten);
    void execution.start(async (options) => {
      const { generateFilledPdf } = await import("@repo/pdf-engine/forms");
      const result = await generateFilledPdf(
        {
          input: { id: draft.inputs[0]?.id ?? "", name: file.name, blob: file },
          values,
          flatten,
          acknowledged: draft.acknowledged,
          limits: pdfLimits,
        },
        options,
      );
      return result.kind === "success" ? { kind: "success", value: [result.value] } : result;
    });
  };
  return (
    <section aria-label="PDF form editor" className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="form-page">Page</Label>
          <NativeSelect
            id="form-page"
            value={page}
            disabled={execution.locked}
            onChange={(event) => setPage(Number(event.target.value))}
          >
            {info.formPages.map((_, index) => (
              <NativeSelectOption key={index} value={index + 1}>
                {index + 1} of {info.pageCount}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button
          variant="outline"
          disabled={page === 1 || execution.locked}
          onClick={() => setPage(page - 1)}
        >
          Previous page
        </Button>
        <Button
          variant="outline"
          disabled={page === info.pageCount || execution.locked}
          onClick={() => setPage(page + 1)}
        >
          Next page
        </Button>
        <Button variant="outline" aria-pressed={view === "page"} onClick={() => setView("page")}>
          On page
        </Button>
        <Button variant="outline" aria-pressed={view === "list"} onClick={() => setView("list")}>
          Field list
        </Button>
        {view === "page" && (
          <div className="space-y-2">
            <Label htmlFor="form-zoom">Page zoom</Label>
            <NativeSelect
              id="form-zoom"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            >
              <NativeSelectOption value={1}>Fit width</NativeSelectOption>
              <NativeSelectOption value={1.5}>150%</NativeSelectOption>
              <NativeSelectOption value={2}>200%</NativeSelectOption>
            </NativeSelect>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Highlighted controls are fillable. Tab moves between controls; arrow keys select radio
        options. Use Field list for larger controls and required or read-only labels.
      </p>
      {view === "page" ? (
        <FormPage
          key={page}
          file={file}
          info={info}
          page={page}
          zoom={zoom}
          values={values}
          disabled={!execution.editable}
          paused={execution.locked}
          onChange={onChange}
        />
      ) : (
        <div role="group" aria-label={`Fields on page ${page}`} className="mt-6 max-w-xl space-y-6">
          <FormFields
            fields={info.fields}
            values={values}
            page={page}
            disabled={!execution.editable}
            onChange={onChange}
          />
        </div>
      )}
      {!info.fields.some((field) => field.widgets.some((widget) => widget.page === page)) && (
        <p className="mt-4 text-sm">No fillable fields on this page.</p>
      )}
      <p role="status" className="mt-4 text-sm">
        {missing
          ? `${missing} required field${missing === 1 ? "" : "s"} still empty. You can save an incomplete form to finish later.`
          : "All required fields have a value."}
      </p>
      <FormOutput
        workspace={workspace}
        flattened={flattened}
        onGenerate={generate}
        onSign={onSign}
      />
    </section>
  );
};
