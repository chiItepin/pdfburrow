export const basePath = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
export const siteOrigin = process.env.PDFBURROW_SITE_ORIGIN ?? "https://chiitepin.github.io";

if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/u.test(basePath)) {
  throw new Error("PDFBURROW_BASE_PATH must be / or a slash-delimited path such as /pdfburrow/.");
}

const origin = new URL(siteOrigin);
if (origin.protocol !== "https:" || origin.origin !== siteOrigin) {
  throw new Error(
    "PDFBURROW_SITE_ORIGIN must be an HTTPS origin without a path or trailing slash.",
  );
}

export const siteDefines = {
  PDFBURROW_BASE_PATH: JSON.stringify(basePath),
  PDFBURROW_SITE_ORIGIN: JSON.stringify(siteOrigin),
};
