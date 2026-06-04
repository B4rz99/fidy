import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractComplexity } from "crap4ts/complexity";
import { CRAP_SRC } from "../crap-scope.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const inputCoveragePath = resolve(projectRoot, "coverage/coverage-final.json");
const outputCoveragePath = resolve(projectRoot, "coverage/crap-normalized-coverage-final.json");

const toProjectPath = (path) => relative(projectRoot, path).split("\\").join("/");

const isAnalyzedSourceFile = (path) =>
  path.endsWith(".ts") &&
  !path.endsWith(".tsx") &&
  !path.includes("/components/") &&
  !path.includes("/ui/");

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      return entry.isFile() && isAnalyzedSourceFile(toProjectPath(path)) ? [path] : [];
    })
  );
  return nested.flat();
}

function groupComplexitiesByFile(complexities) {
  return complexities.reduce((byFile, complexity) => {
    const byName = byFile.get(complexity.identity.filePath) ?? new Map();
    const items = byName.get(complexity.identity.qualifiedName) ?? [];
    byName.set(complexity.identity.qualifiedName, [...items, complexity]);
    byFile.set(complexity.identity.filePath, byName);
    return byFile;
  }, new Map());
}

function spanOverlap(left, right) {
  const start = Math.max(left.startLine, right.start.line);
  const end = Math.min(left.endLine, right.end.line + 1);
  return Math.max(0, end - start);
}

function findMatchingComplexity(complexities, fnLoc) {
  return complexities
    .map((complexity) => ({ complexity, overlap: spanOverlap(complexity.identity.span, fnLoc) }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)[0]?.complexity;
}

function normalizeFunctionLocation(fnEntry, complexity) {
  const span = complexity.identity.span;
  fnEntry.loc = {
    start: { line: span.startLine, column: span.startColumn },
    end: { line: Math.max(span.startLine, span.endLine - 1), column: span.endColumn },
  };
}

const sourceFiles = (
  await Promise.all(CRAP_SRC.map((dir) => collectSourceFiles(resolve(projectRoot, dir))))
).flat();

const complexities = (
  await Promise.all(
    sourceFiles.map(async (file) => extractComplexity(await readFile(file, "utf8"), toProjectPath(file)))
  )
).flat();
const complexitiesByFile = groupComplexitiesByFile(complexities);
const coverage = JSON.parse(await readFile(inputCoveragePath, "utf8"));

for (const fileCoverage of Object.values(coverage)) {
  const filePath = toProjectPath(fileCoverage.path);
  const complexitiesByName = complexitiesByFile.get(filePath);
  if (!complexitiesByName) continue;
  const fileComplexities = [...complexitiesByName.values()].flat();

  for (const fnEntry of Object.values(fileCoverage.fnMap)) {
    const sameNameComplexities = complexitiesByName.get(fnEntry.name);
    const complexity = findMatchingComplexity(sameNameComplexities ?? fileComplexities, fnEntry.loc);
    if (complexity) normalizeFunctionLocation(fnEntry, complexity);
  }
}

await writeFile(outputCoveragePath, `${JSON.stringify(coverage)}\n`);
