import type { SplitSelection } from "@repo/pdf-engine";

export type SplitOperation = Exclude<SplitSelection["mode"], "remove"> | "sets";
