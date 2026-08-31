// This imports a function that can run another program from Node.js.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
// turns a relative path into an absolute path.
import { resolve } from "node:path";

export interface VeraPdfIssue {
  // veraPDF's PDF/A conformance model is binary (compliant/non-compliant) — there's no
  // separate warning tier the way KoSIT's Schematron severities have. Every failed check is
  // an error; the field is kept (not hardcoded away) so this shape stays parallel to KositIssue.
  // location is optional
  severity: "error";
  message: string;
  location?: string;
}

export interface VeraPdfResult {
  file: string;
  valid: boolean;
  issues: VeraPdfIssue[];
}

export interface VeraPdfOptions {
  /** Path to the installed veraPDF CLI script. Defaults to tools/verapdf/verapdf. */
  cliPath?: string;
  /** PDF/A flavour flag passed via -f. Defaults to "3b" (this project only produces PDF/A-3b). */
  flavour?: string;
}

const DEFAULT_CLI = "tools/verapdf/verapdf";
const DEFAULT_FLAVOUR = "3b";
// tools/verapdf/verapdf resolves Java via $JAVA_HOME/bin/java (falling back to `which java` on
// PATH) — a shell script one layer removed from execFileSync's own cwd handling, so this is
// resolved to an absolute path rather than left relative like DEFAULT_JAR/DEFAULT_CLI are.
const PORTABLE_JRE_HOME = resolve("tools/jre");

/**
 * Runs the official veraPDF CLI (a Java tool, see `make verapdf-setup`) against one or more
 * PDF files and returns a structured, per-file PDF/A-3b conformance result.
 *
 * veraPDF is the authoritative check for PDF/A-3 conformance — the same role runKosit() plays
 * for XRechnung XML.
 */

// example
// runVeraPdf([
//   "dist/pdf/invoice1.pdf",
//   "dist/pdf/invoice2.pdf",
// ]);
export function runVeraPdf(pdfPaths: string[], options: VeraPdfOptions = {}): VeraPdfResult[] {
  const cliPath = options.cliPath ?? DEFAULT_CLI;
  const flavour = options.flavour ?? DEFAULT_FLAVOUR;

  if (!existsSync(cliPath)) {
    throw new Error(
      `veraPDF CLI not found at ${cliPath}. Run \`make verapdf-setup\` first — see docs/COMPLIANCE.md.`,
    );
  }

  const env = { ...process.env };
  if (existsSync(`${PORTABLE_JRE_HOME}/bin/java`)) 
    env.JAVA_HOME = PORTABLE_JRE_HOME;

  let stdout: string;
  try {
    // example
    // [
    //   "-f", "3b",              (validate against the PDF/A-3b flavour)
    //   "--format", "xml",       (report format)
    //   "invoice1.pdf",
    //   "invoice2.pdf",
    // ]
    // veraPDF supports a batch of paths in one call, returning one <report> with one
    // <jobs><job> per input file — unlike KoSIT there's no per-file report file to read.
    stdout = execFileSync(cliPath, ["-f", flavour, "--format", "xml", ...pdfPaths], {
      // stdio[0] = stdin -> ignore, do not send anything to veraPDF
      // stdio[1] = stdout -> capture the XML validation report
      // stdio[2] = stderr -> capture reasons in case the process fails
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env,
    });
  } catch (err) {
    // ENOENT: file or command does not exist
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new Error(
        "veraPDF validation requires a `java` binary (or a portable JRE at tools/jre/bin/java) " +
          "and the veraPDF CLI under tools/verapdf/. Run `make verapdf-setup` first — " +
          "see docs/COMPLIANCE.md.",
      );
    }
    // veraPDF exits non-zero whenever any input file is non-compliant, unparseable, or missing
    // — that is expected behavior, not a wrapper failure. The actual per-file result is read
    // from the report XML captured on stdout below, recovered here from the thrown error, not
    // from the process exit code (same lesson 90.kosit.ts's comment already documents).
    stdout = (err as { stdout?: string }).stdout ?? "";
  }

  // Parse every PDF and parseReport extracts result for each indivicual PDF.
  return pdfPaths.map((pdfPath) => parseReport(pdfPath, stdout));
}

function parseReport(pdfPath: string, report: string): VeraPdfResult {
  // veraPDF's <name> in the report is always the resolved absolute path, even when a relative
  // path was passed on the command line — so matching a <job> back to the caller's input path
  // must compare resolved paths, not raw strings.
  const target = resolve(pdfPath);

  // <job>...</job> — one per input file, in the order given on the command line.
  const jobRe = /<job>([\s\S]*?)<\/job>/g;
  for (const match of report.matchAll(jobRe)) {
    const job = match[1] ?? "";
    // from <name>/home/test/invoice.pdf</name>
    // to /home/test/invoice.pdf
    const name = /<name>([^<]*)<\/name>/.exec(job)?.[1];
    if (name !== target) continue;

    // An unparseable PDF produces a <taskException> instead of a <validationReport> — no
    // rules to check, just report the parse failure as a single error.
    const exceptionMessage = /<exceptionMessage>([^<]*)<\/exceptionMessage>/.exec(job)?.[1];
    if (exceptionMessage) {
      return {
        file: pdfPath,
        valid: false,
        issues: [{ severity: "error", message: exceptionMessage }],
      };
    }

    const isCompliant =
      /<validationReport\b[^>]*\bisCompliant="([^"]*)"/.exec(job)?.[1] === "true";

    // <rule specification="..." clause="6.2.11.4.1" ...>...<check status="failed">
    //   <context>...</context><errorMessage>...</errorMessage></check>...</rule>
    // A single <rule> can contain multiple failed <check> children (e.g. one DeviceRGB rule
    // failing at two different locations in the same document).

    // <rule>
    //    ↓
    // get clause

    // <check status="failed">
    //    ↓
    // get body

    // <context>
    //    ↓
    // get location

    // <errorMessage>
    //    ↓
    // get message
    //    ↓
    // issues.push(...)

    // Example)
    
    // so below XML 
    // <rule clause="6.3.4">
    //   <check status="failed">
    //     <context>pages[0]/fonts[2]</context>
    //     <errorMessage>Font is not embedded</errorMessage>
    //   </check>
    // </rule>

    // into this typescript object
    // {
    //   severity: "error",
    //   message: "6.3.4: Font is not embedded",
    //   location: "pages[0]/fonts[2]",
    // }

    const issues: VeraPdfIssue[] = [];
    const ruleRe = /<rule\b([^>]*)>([\s\S]*?)<\/rule>/g;
    for (const ruleMatch of job.matchAll(ruleRe)) {
      // clause is the rule number from the PDF/A standard
      const clause = /\bclause="([^"]*)"/.exec(ruleMatch[1] ?? "")?.[1];
      const checkRe = /<check status="failed">([\s\S]*?)<\/check>/g;
      for (const checkMatch of (ruleMatch[2] ?? "").matchAll(checkRe)) {
        const body = checkMatch[1] ?? "";
        const location = /<context>([^<]*)<\/context>/.exec(body)?.[1];
        const message =
          /<errorMessage>([^<]*)<\/errorMessage>/.exec(body)?.[1] ?? "veraPDF check failed";
        issues.push({
          severity: "error",
          message: clause ? `${clause}: ${message}` : message,
          ...(location ? { location } : {}),
        });
      }
    }

    // Invariant callers rely on (e.g. validate-verapdf's Makefile target, which filters
    // issues by severity === "error" to decide ✓/✗): valid === false implies issues.length > 0.
    // If isCompliant="false" but the rule/check regex above matched nothing — a report shape
    // veraPDF changed, or a rule type this parser doesn't recognize yet — fail loud with a
    // synthetic issue instead of silently reporting zero errors for a rejected document.
    if (!isCompliant && issues.length === 0) {
      issues.push({
        severity: "error",
        message: "veraPDF reported the document as non-compliant.",
      });
    }

    return { file: pdfPath, valid: isCompliant, issues };
  }

  throw new Error(
    `veraPDF produced no report for ${pdfPath} — check the file exists and is a valid PDF.`,
  );
}

// defines a function that checks whether err is a Node.js error,
// and if it returns true, TypeScript will treat err as a NodeJS.ErrnoException.
// if it returns false, TypeScript does not narrow the type, so err remains unknown
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  // Return true only if err is an Error object and it has a code property
  return err instanceof Error && "code" in err;
}
