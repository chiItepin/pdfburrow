import type { Page } from "@playwright/test";

declare global {
  interface Window {
    pageSetDiagnostics: {
      readonly selections: readonly unknown[];
      readonly workers: number;
      readonly urls: number;
    };
    pageSetFailDownload: boolean;
  }
}

export const installPageSetDiagnostics = async (page: Page) => {
  await page.addInitScript(() => {
    const selections: unknown[] = [];
    const workers = new Set<Worker>();
    const urls = new Set<string>();
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      private split: boolean;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.split = String(url).includes("/split.worker.js");
        workers.add(this);
      }
      postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions) {
        if (this.split && message && typeof message === "object" && "selection" in message) {
          selections.push(message.selection);
        }
        if (Array.isArray(options)) {
          super.postMessage(message, options);
        } else {
          super.postMessage(message, options);
        }
      }
      terminate() {
        workers.delete(this);
        super.terminate();
      }
    };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      revoke(url);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && window.pageSetFailDownload) {
        throw new Error("Download requests are unavailable.");
      }
      click.call(this);
    };
    Object.defineProperty(window, "pageSetDiagnostics", {
      get: () => ({ selections, workers: workers.size, urls: urls.size }),
    });
  });
};
