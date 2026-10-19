import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/core-ui";
import type { FormInfo, FormValue } from "@repo/pdf-engine";
import { useMarkupPage } from "../markup/useMarkupPage";
import { FormFields } from "./FormFields";

export const FormPage = ({
  file,
  info,
  page,
  zoom,
  values,
  disabled,
  paused,
  onChange,
}: {
  file: File;
  info: FormInfo;
  page: number;
  zoom: number;
  values: readonly FormValue[];
  disabled: boolean;
  paused: boolean;
  onChange: (name: string, value: string | boolean) => void;
}) => {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const geometry = info.formPages[page - 1]!;
  const { preview, retry } = useMarkupPage(file, page, geometry, paused, true);
  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, width / geometry.width) * zoom;
  return (
    <div ref={container} className="mt-4 max-h-[70dvh] overflow-auto rounded-md border bg-muted/30">
      {preview.state === "error" ? (
        <div className="space-y-3 p-4">
          <p role="alert">{preview.message} You can still edit using Field list.</p>
          <Button variant="outline" onClick={retry} disabled={paused}>
            Retry form preview
          </Button>
        </div>
      ) : preview.state === "loading" ? (
        <p role="status" className="p-6">
          Loading page preview...
        </p>
      ) : (
        <div
          data-theme="light"
          className="relative mx-auto bg-white text-black"
          style={{ width: geometry.width * scale, height: geometry.height * scale }}
          role="group"
          aria-label={`Form page ${page}`}
        >
          <img
            src={preview.url}
            alt={`PDF form page ${page}; editable controls are highlighted`}
            className="absolute inset-0 h-full w-full"
          />
          <FormFields
            fields={info.fields}
            values={values}
            page={page}
            scale={scale}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
};
