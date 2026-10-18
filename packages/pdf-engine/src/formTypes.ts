import type { MarkupGeometry } from "./markupTypes";
import type { PdfInfo, PdfInput, PdfLimits } from "./types";

export interface FormWidget {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly option?: string;
}

interface FieldDetails {
  readonly name: string;
  readonly label: string;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly widgets: readonly FormWidget[];
}

export type FormField = FieldDetails &
  (
    | {
        readonly kind: "text";
        readonly value: string;
        readonly multiline: boolean;
        readonly maxLength?: number;
      }
    | { readonly kind: "checkbox"; readonly value: boolean }
    | {
        readonly kind: "checkbox-group";
        readonly value: string;
        readonly options: readonly string[];
      }
    | { readonly kind: "radio"; readonly value: string; readonly options: readonly string[] }
    | {
        readonly kind: "dropdown";
        readonly value: string;
        readonly options: readonly { value: string; label: string }[];
      }
  );

export interface FormInfo extends PdfInfo {
  readonly fields: readonly FormField[];
  readonly formPages: readonly MarkupGeometry[];
}

export interface FormValue {
  readonly name: string;
  readonly value: string | boolean;
}

export interface FillFormRequest {
  readonly input: PdfInput;
  readonly values: readonly FormValue[];
  readonly flatten: boolean;
  readonly acknowledged: boolean;
  readonly limits?: PdfLimits;
}
