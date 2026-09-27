import { basename } from "node:path";

/** @type {import("eslint").ESLint.Plugin} */
export const filenameRules = {
  rules: {
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
