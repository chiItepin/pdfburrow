import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../pdf-engine/src/", import.meta.url));
const loader = resolve(sourceRoot, "pdf.ts");
const preparation = resolve(sourceRoot, "preparePdfDocument.ts");
const internals = new Map([
  [resolve(sourceRoot, "preparePdfDocument"), { name: "preparePdfDocument", owner: loader }],
  [resolve(sourceRoot, "inspectDocument"), { name: "inspectDocument", owner: preparation }],
  [resolve(sourceRoot, "preservePdfForms"), { name: "preservePdfForms", owner: preparation }],
  [
    resolve(sourceRoot, "inspectFillableForm"),
    { name: "inspectFormForFilling", owner: preparation },
  ],
]);

/** @param {import("eslint").JSSyntaxElement} node */
const isTypeOnly = (node) =>
  ("importKind" in node && node.importKind === "type") ||
  ("exportKind" in node && node.exportKind === "type") ||
  ("isTypeOnly" in node && node.isTypeOnly === true);

/** @param {import("eslint").JSSyntaxElement | undefined} node */
const literalText = (node) =>
  node?.type === "Literal" && "value" in node && typeof node.value === "string"
    ? node.value
    : undefined;

/** @param {import("eslint").JSSyntaxElement} node */
const nameOf = (node) =>
  node.type === "Identifier" && "name" in node && typeof node.name === "string"
    ? node.name
    : literalText(node);

/** @param {string} source */
const isPdfLibrary = (source) => source === "pdf-lib" || source.startsWith("pdf-lib/");

/** @type {import("eslint").Rule.RuleModule} */
const preparationBoundary = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      owner:
        "{{name}} is owned by src/{{owner}}. Use loadValidatedPdf instead of importing preparation internals.",
      constructor:
        "Outside src/pdf.ts, use PDFDocument only through .create; do not alias, destructure, or pass the constructor. Use loadValidatedPdf for existing PDFs.",
      named:
        "Use explicit named ESM imports from the public module so PDF preparation ownership can be checked; use loadValidatedPdf for existing PDFs.",
      reexport:
        "Do not re-export PDFDocument or protected preparation functions. Expose loadValidatedPdf or a capability instead.",
      literal: "Use a string-literal module specifier so PDF preparation ownership can be checked.",
    },
  },
  create: (context) => {
    const filename = resolve(context.filename);
    const fromRoot = relative(sourceRoot, filename);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
      return {};
    }
    const sourceCode = context.sourceCode;
    /** @param {string} source */
    const internalFor = (source) =>
      source.startsWith(".")
        ? internals.get(
            resolve(dirname(filename), source.replace(/[?#].*$/u, "")).replace(
              /\.(?:[cm]?[jt]s|tsx)$/u,
              "",
            ),
          )
        : undefined;

    /**
     * Check references to the imported binding, not identifiers with the same spelling.
     * Restrict constructor escape instead of attempting alias/data-flow analysis.
     * @param {import("eslint").Scope.Variable} variable
     * @param {boolean} documentConstructor
     */
    const checkReferences = (variable, documentConstructor) => {
      for (const reference of variable.references) {
        const node = reference.identifier;
        const ancestors = sourceCode.getAncestors(node);
        const parent = ancestors.at(-1);
        const declaration = ancestors.at(-2);
        if (
          ("isValueReference" in reference && !reference.isValueReference) ||
          (parent?.type === "ExportSpecifier" &&
            (isTypeOnly(parent) || (declaration && isTypeOnly(declaration))))
        ) {
          continue;
        }
        if (parent?.type === "ExportSpecifier" || parent?.type === "ExportDefaultDeclaration") {
          context.report({ node, messageId: "reexport" });
        } else if (documentConstructor && filename !== loader) {
          const creating =
            parent?.type === "MemberExpression" &&
            parent.object === node &&
            (parent.computed ? literalText(parent.property) : nameOf(parent.property)) === "create";
          if (!creating) {
            context.report({ node, messageId: "constructor" });
          }
        }
      }
    };

    /** @param {import("eslint").JSSyntaxElement} node
     * @param {string | undefined} source */
    const checkOpaqueImport = (node, source) => {
      if (source === undefined) {
        context.report({ node, messageId: "literal" });
      } else if (internalFor(source) || (isPdfLibrary(source) && filename !== loader)) {
        context.report({ node, messageId: "named" });
      }
    };

    return {
      ImportDeclaration: (node) => {
        if (isTypeOnly(node)) {
          return;
        }
        const source = literalText(node.source);
        if (source === undefined) {
          return;
        }
        const specifiers = node.specifiers.filter((specifier) => !isTypeOnly(specifier));
        if (specifiers.length === 0) {
          return;
        }
        const internal = internalFor(source);
        if (source.startsWith("pdf-lib/") && filename !== loader) {
          context.report({ node, messageId: "named" });
          return;
        }
        for (const specifier of specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            checkOpaqueImport(specifier, source);
            continue;
          }
          const name = nameOf(specifier.imported);
          const protectedImport = internal !== undefined && internal.name === name;
          if (protectedImport && filename !== internal.owner) {
            context.report({
              node: specifier,
              messageId: "owner",
              data: { name, owner: relative(sourceRoot, internal.owner) },
            });
          }
          const documentConstructor = isPdfLibrary(source) && name === "PDFDocument";
          if (protectedImport || documentConstructor) {
            const variable = sourceCode
              .getDeclaredVariables(node)
              .find((binding) => binding.name === specifier.local.name);
            if (variable) {
              checkReferences(variable, documentConstructor);
            }
          }
        }
      },
      ExportNamedDeclaration: (node) => {
        if (!node.source || isTypeOnly(node)) {
          return;
        }
        const source = literalText(node.source);
        if (source === undefined) {
          return;
        }
        for (const specifier of node.specifiers.filter((item) => !isTypeOnly(item))) {
          const name = nameOf(specifier.local);
          if (
            internalFor(source)?.name === name ||
            (isPdfLibrary(source) && (name === "PDFDocument" || name === "default")) ||
            source.startsWith("pdf-lib/")
          ) {
            context.report({ node: specifier, messageId: "reexport" });
          }
        }
      },
      ExportAllDeclaration: (node) => {
        const source = literalText(node.source);
        if (source && !isTypeOnly(node) && (internalFor(source) || isPdfLibrary(source))) {
          context.report({ node, messageId: "reexport" });
        }
      },
      ImportExpression: (node) => checkOpaqueImport(node, literalText(node.source)),
      CallExpression: (node) => {
        const callee = node.callee;
        if (
          (callee.type === "Identifier" && callee.name === "require") ||
          (callee.type === "MemberExpression" && nameOf(callee.property) === "require")
        ) {
          checkOpaqueImport(node, literalText(node.arguments[0]));
        }
      },
      TSImportEqualsDeclaration: /** @param {import("eslint").JSSyntaxElement} node */ (node) => {
        if (!isTypeOnly(node)) {
          context.report({ node, messageId: "named" });
        }
      },
    };
  },
};

/** @type {import("eslint").ESLint.Plugin} */
export const pdfPreparationRules = {
  rules: { "preparation-boundary": preparationBoundary },
};
