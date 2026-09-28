import { basename } from "node:path";

/** @type {import("eslint").ESLint.Plugin} */
export const filenameRules = {
  rules: {
    "non-component-camel-case": {
      meta: {
        type: "suggestion",
        schema: [],
        messages: {
          camelCase:
            'Non-component filename "{{filename}}" must use camelCase, for example "usePdfDraft.ts". Conventional .test, .spec, .worker, .config, and .d suffixes are allowed.',
        },
      },
      create: (context) => ({
        Program: (node) => {
          const filename = basename(context.filename);
          if (
            !/^[a-z][A-Za-z0-9]*(?:\.(?:test|spec|worker|config|d))?\.(?:ts|mts|cts|js|mjs|cjs)$/u.test(
              filename,
            )
          ) {
            context.report({ node, messageId: "camelCase", data: { filename } });
          }
        },
      }),
    },
    "tsx-pascal-case": {
      meta: {
        type: "suggestion",
        schema: [],
        messages: {
          pascalCase:
            'TSX filename "{{filename}}" must use PascalCase, for example "FilePicker.tsx".',
        },
      },
      create: (context) => ({
        Program: (node) => {
          const filename = basename(context.filename);
          if (!/^[A-Z][A-Za-z0-9]*\.tsx$/u.test(filename)) {
            context.report({ node, messageId: "pascalCase", data: { filename } });
          }
        },
      }),
    },
  },
};
