const fs = require("node:fs");
const path = require("node:path");

function inlineSqlImports({ types: t }) {
  return {
    name: "inline-sql-imports",
    visitor: {
      ImportDeclaration(importPath, state) {
        const source = importPath.node.source.value;
        if (typeof source !== "string" || !source.endsWith(".sql")) {
          return;
        }

        const defaultSpecifier = importPath.node.specifiers.find((specifier) =>
          t.isImportDefaultSpecifier(specifier)
        );
        if (!defaultSpecifier) {
          throw importPath.buildCodeFrameError("SQL imports must use a default import.");
        }

        const filename = state.file.opts.filename;
        if (!filename) {
          throw importPath.buildCodeFrameError("Cannot resolve SQL import without a filename.");
        }

        const sqlPath = path.resolve(path.dirname(filename), source);
        const sql = fs.readFileSync(sqlPath, "utf8");
        importPath.replaceWith(
          t.variableDeclaration("const", [
            t.variableDeclarator(defaultSpecifier.local, t.stringLiteral(sql)),
          ])
        );
      },
    },
  };
}

module.exports = (api) => {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [inlineSqlImports],
  };
};
