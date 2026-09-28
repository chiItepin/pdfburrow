type PreviewRequest = {
  name: string;
  signal: AbortSignal;
  complete: () => void;
};

declare global {
  interface Window {
    previewFixture: {
      fail: boolean;
      ignoreAbort: boolean;
      requests: PreviewRequest[];
      urls: string[];
      revokedUrls: string[];
    };
  }
}

window.previewFixture = {
  fail: true,
  ignoreAbort: false,
  requests: [],
  urls: [],
  revokedUrls: [],
};

const createObjectURL = URL.createObjectURL.bind(URL);
const revokeObjectURL = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (blob) => {
  const url = createObjectURL(blob);
  window.previewFixture.urls.push(url);
  return url;
};
URL.revokeObjectURL = (url) => {
  window.previewFixture.revokedUrls.push(url);
  revokeObjectURL(url);
};

export const previewPdf = (file: File, signal: AbortSignal) => {
  if (window.previewFixture.fail) {
    return Promise.reject(new Error("Controlled preview failure."));
  }
  return new Promise<Blob>((resolve, reject) => {
    window.previewFixture.requests.push({
      name: file.name,
      signal,
      complete: () =>
        resolve(
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="108" height="144"><rect width="108" height="144" fill="green"/></svg>',
            ],
            { type: "image/svg+xml" },
          ),
        ),
    });
    signal.addEventListener(
      "abort",
      () => {
        if (!window.previewFixture.ignoreAbort) {
          reject(new DOMException("Aborted", "AbortError"));
        }
      },
      { once: true },
    );
  });
};
