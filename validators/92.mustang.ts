// This imports a function that can run another program from Node.js.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface MustangIssue {
  severity: "error" | "warning" | "information";
  message: string;
  location?: string;
}

export interface MustangResult {
  file: string;
  valid: boolean;
  issues: MustangIssue[];
}

export interface MustangOptions {
  /** Path to the Mustang CLI standalone jar. Defaults to tools/mustang/mustang-cli.jar. */
  jarPath?: string;
}

const DEFAULT_JAR = "tools/mustang/mustang-cli.jar";
const PORTABLE_JAVA = "tools/jre/bin/java";

function resolveJavaBin(): string {
  return existsSync(PORTABLE_JAVA) ? PORTABLE_JAVA : "java";
}

function assertJarExists(jarPath: string): void {
  if (!existsSync(jarPath)) {
    throw new Error(
      `Mustang CLI jar not found at ${jarPath}. Run \`make mustang-setup\` first — see docs/COMPLIANCE.md.`,
    );
  }
}

function missingToolError(action: string): Error {
  return new Error(
    `Mustang ${action} requires a \`java\` binary (or a portable JRE at tools/jre/bin/java) ` +
      "and the Mustang CLI jar under tools/mustang/. Run `make mustang-setup` first — " +
      "see docs/COMPLIANCE.md.",
  );
}

/**
 * Extracts the embedded XML from a hybrid PDF using Mustang Project's own `--action extract` —
 * an independent, third-party read of the PDF, deliberately not this project's own
 * `extractEmbeddedXml()` (adapters/hybrid-pdf.ts). Used to prove the PDF is genuinely readable
 * by a standard e-invoicing tool, not just self-consistent with this project's own code.
 */
export function extractWithMustang(pdfPath: string, options: MustangOptions = {}): string {
  const jarPath = options.jarPath ?? DEFAULT_JAR;
  assertJarExists(jarPath);

  const outDir = mkdtempSync(join(tmpdir(), "mustang-extract-"));
  const outPath = join(outDir, "extracted.xml");

  try {
    execFileSync(
      resolveJavaBin(),
      ["-jar", jarPath, "--action", "extract", "--source", pdfPath, "--out", outPath],
      { stdio: "pipe" },
    );
  } catch (err) {
    // ENOENT: Error No Entry
    if (isNodeError(err) && err.code === "ENOENT") 
      throw missingToolError("extraction");
    throw err;
  }
  // Make sure Mustang actually created XML
  if (!existsSync(outPath)) {
    throw new Error(`Mustang produced no extracted XML for ${pdfPath}.`);
  }
  // Read and return the XML
  return readFileSync(outPath, "utf8");
}

/**
 * Runs Mustang Project's own `--action validate` (EN16931/XRechnung Schematron + XSD for an XML
 * file, plus PDF/A conformance when given a PDF) against one or more files and returns a
 * structured, per-file result — an independent second opinion alongside runKosit()/runVeraPdf().
 *
 * Unlike KoSIT/veraPDF, Mustang's CLI exit code is a deliberate, meaningful signal — it exits
 * non-zero exactly when its own report's overall status is "invalid" — so this wrapper cross-
 * checks the two instead of discarding the exit code as incidental noise the way 90.kosit.ts and
 * 91.vera-pdf.ts do.
 */
export function runMustang(paths: string[], options: MustangOptions = {}): MustangResult[] {
  const jarPath = options.jarPath ?? DEFAULT_JAR;
  assertJarExists(jarPath);

  return paths.map((path) => {
    let stdout: string;
    let exitedNonZero = false;
    try {
      stdout = execFileSync(
        resolveJavaBin(),
        ["-jar", jarPath, "--action", "validate", "--source", path],
        { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
      );
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") 
        throw missingToolError("validation");
      // Confirmed against Mustang-CLI 2.26.0: it exits non-zero exactly when its report's
      // final <summary status="invalid"/> — a meaningful, corroborating validity signal, not noise. 
      // Recorded here and cross-checked against the parsed report below.
      exitedNonZero = true;
      stdout = (err as { stdout?: string }).stdout ?? "";
    }
    return parseReport(path, stdout, exitedNonZero);
  });
}

function parseReport(file: string, report: string, exitedNonZero: boolean): MustangResult {
  // The report ends with one final <summary status="valid|invalid"/> as a direct child of
  // <validation> — the overall status across both the <pdf> and <xml> blocks when a PDF was
  // validated, or just the <xml> block for an XML file. Earlier <summary> elements belong to
  // those inner blocks, so only the last occurrence in the report is authoritative.
  const summaryMatches = [...report.matchAll(/<summary status="([^"]*)"\s*\/>/g)];
  // .at(-1): Give me the last item
  const lastStatus = summaryMatches.at(-1)?.[1];
  if (lastStatus === undefined) {
    throw new Error(`Mustang produced no recognizable report for ${file}.`);
  }
  const valid = lastStatus === "valid";

  // Disagreement between the report's own status and the process exit code would mean this
  // parser's understanding of Mustang's report shape is stale — fail loud rather than silently
  // trusting one signal over the other (see 92.mustang.ts's exit-code comment above).
  if (valid === exitedNonZero) {
    throw new Error(
      `Mustang's report status ("${lastStatus}") disagrees with its process exit code for ` +
        `${file} — the report parser may be out of date with the installed Mustang CLI version.`,
    );
  }

  // <error type="24" location="..." criterion="...">message</error> / <warning ...> / <notice ...>
  const messageRe = /<(error|warning|notice)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  const severityByTag = { error: "error", warning: "warning", notice: "information" } as const;
  const issues: MustangIssue[] = [];
  for (const match of report.matchAll(messageRe)) {
    const tag = match[1] as keyof typeof severityByTag;
    const attrs = match[2] ?? "";
    const body = match[3] ?? "";
    const location = /\blocation="([^"]*)"/.exec(attrs)?.[1];
    issues.push(
      location
        ? { severity: severityByTag[tag], message: body.trim(), location }
        : { severity: severityByTag[tag], message: body.trim() },
    );
  }

  return { file, valid, issues };
}

// defines a function that checks whether err is a Node.js error,
// and if it returns true, TypeScript will treat err as a NodeJS.ErrnoException.
// if it returns false, TypeScript does not narrow the type, so err remains unknown
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  // Return true only if err is an Error object and it has a code property
  return err instanceof Error && "code" in err;
}
