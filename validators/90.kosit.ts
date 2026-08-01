// This imports a function that can run another program from Node.js.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export interface KositIssue {
  severity: "error" | "warning" | "information";
  message: string;
  location?: string;
}

export interface KositResult {
  file: string;
  valid: boolean;
  issues: KositIssue[];
}

export interface KositOptions {
  /** Path to the KoSIT validator standalone jar. Defaults to tools/kosit/validator.jar. */
  jarPath?: string;
  /** Path to the XRechnung scenarios.xml. Defaults to tools/kosit/config/scenarios.xml. */
  scenariosPath?: string;
  /** Directory KoSIT writes *-report.xml files into. Defaults to a fresh temp dir. */
  outDir?: string;
}

const DEFAULT_JAR = "tools/kosit/validator.jar";
const DEFAULT_SCENARIOS = "tools/kosit/config/scenarios.xml";
const PORTABLE_JAVA = "tools/jre/bin/java";

function resolveJavaBin(): string {
  // if there is no PORTABLE_JAVA then run java which runs 'java -jar validator.jar'
  return existsSync(PORTABLE_JAVA) ? PORTABLE_JAVA : "java";
}

/**
 * Runs the official KoSIT validator (a Java CLI tool, see `make kosit-setup`) against
 * one or more XRechnung XML files and returns a structured, per-file result.
 *
 * KoSIT is the authoritative check for XRechnung Schematron/XSD conformance — this is
 * additive to `validateBusinessRules`, not a replacement for it (see docs/LIMITATIONS.md).
 */

// example
// runKosit([
//   "invoice1.xml",
//   "invoice2.xml"
// ]);
export function runKosit(xmlPaths: string[], options: KositOptions = {}): KositResult[] {
  const jarPath = options.jarPath ?? DEFAULT_JAR;
  const scenariosPath = options.scenariosPath ?? DEFAULT_SCENARIOS;
  // mkdtempSync function adds a random unique 6 characters to the end
  const outDir = options.outDir ?? mkdtempSync(join(tmpdir(), "kosit-"));

  if (!existsSync(jarPath) || !existsSync(scenariosPath)) {
    throw new Error(
      `KoSIT jar/config not found at ${jarPath} / ${scenariosPath}. Run \`make kosit-setup\` first — see docs/COMPLIANCE.md.`,
    );
  }

  try {
    // example
    // [
    //   "-jar",       (run this .jar file)
    //   "validator.jar",
    //   "-s",         (Use this scenarios configuration file.)
    //   "config/scenarios.xml",
    //   "-o",         (Write the output files into this folder.)
    //   "reports",
    //   "invoice1.xml",
    //   "invoice2.xml"
    // ]
    // with pipe : Capture the program's output instead of printing it directly to the terminal
    execFileSync(
      resolveJavaBin(),
      ["-jar", jarPath, "-s", scenariosPath, "-o", outDir, ...xmlPaths],
      { stdio: "pipe" },
    );
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new Error(
        "KoSIT validation requires a `java` binary (or a portable JRE at tools/jre/bin/java) " +
          "and the KoSIT jar/config under tools/kosit/. Run `make kosit-setup` first — " +
          "see docs/COMPLIANCE.md.",
      );
    }
    // Usually
    // exit code 0 Success
    // exit code 1 Failure

    // But
    // KoSIT exits non-zero whenever any input file is rejected — that is expected
    // behavior, not a wrapper failure. The actual per-file result is read from the
    // generated report XML below, not from the process exit code.
  }

  // for every XML file that was validated, look up its individual report
  // and turn it into a structured result
  // and return the array of all those results.
  // example
  // const xmlPaths = [
  //   "invoice1.xml",
  //   "invoice2.xml",
  //   "invoice3.xml"
  // ];
  // .map() goes through every item in the array.
  // parseReport("invoice1.xml", outDir)
  // parseReport("invoice2.xml", outDir)
  // parseReport("invoice3.xml", outDir)
  return xmlPaths.map((xmlPath) => parseReport(xmlPath, outDir));
}

function parseReport(xmlPath: string, outDir: string): KositResult {
  // Example:

  // xmlPath = "/home/user/invoices/domestic-simple.xml"
  // outDir  = "/tmp/validation-output"

  // basename(xmlPath)                          // "domestic-simple.xml"
  // basename(xmlPath).replace(/\.xml$/i, "")   // "domestic-simple"
  // `${...}-report.xml`                        // "domestic-simple-report.xml"
  // join(outDir, ...)                          // "/tmp/validation-output/domestic-simple-report.xml"

  // '\.' : just dot
  // $ : end of the string
  // i : cover upper, lower case
  const reportPath = join(outDir, `${basename(xmlPath).replace(/\.xml$/i, "")}-report.xml`);

  // example — same file, two ways:

  // readFileSync("hello.txt");         // <Buffer 68 65 6c 6c 6f>  (raw bytes, not readable)
  // readFileSync("hello.txt", "utf8"); // "hello"                  (actual text)
  const report = readFileSync(reportPath, "utf8");

  // if there is noscenario then returns error
  if (report.includes("<rep:noScenarioMatched")) {
    return {
      file: xmlPath,
      valid: false,
      issues: [
        {
          severity: "error",
          message:
            "No KoSIT scenario matched this document — check the CustomizationID and root namespace.",
        },
      ],
    };
  }

  const issues: KositIssue[] = [];

  // <rep:message : find a tag that starts with <rep:message
  // \b : word boundary, so it doesn't accidentally match <rep:messageFoo>
  // ([^>]*) : captures everything until the >
  // example)
  // <rep:message severity="error" location="/Invoice">
  // it captures
  // severity="error" location="/Invoice"

  // ([\s\S]*?) : capture everything inside the tag
  // *? : stop as soon as you find the first closing </rep:message> tag.
  // <\/rep:message> : closing tag

  // /.../g : stands for global
  const messageRe = /<rep:message\b([^>]*)>([\s\S]*?)<\/rep:message>/g;

  // Example input (the report string contains this):

  // <rep:message level="error" xpathLocation="/Invoice/ID">Missing invoice ID</rep:message>

  // What the loop does with it:

  // attrs    = 'level="error" xpathLocation="/Invoice/ID"'
  // body     = "Missing invoice ID"
  // severity = "error"                  // pulled from level="error"
  // location = "/Invoice/ID"            // pulled from xpathLocation="..."

  // Result pushed into issues:

  // { severity: "error", message: "Missing invoice ID", location: "/Invoice/ID" }
  for (const match of report.matchAll(messageRe)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    // \b : make sure level= as a whole word
    // level=" : exact text to find
    // ([^"]*) : capture group
    // " : closing quote

    // example of .exec()
    // const attrs    = 'level="error" xpathLocation="/Invoice/ID"'

    // /\blevel="([^"]*)"/.exec(attrs)

    // index 0 = 'level="error"'
    // index 1 = 'error'
    const severity = (/\blevel="([^"]*)"/.exec(attrs)?.[1] ??
      "information") as KositIssue["severity"];
    const location = /\bxpathLocation="([^"]*)"/.exec(attrs)?.[1];
    issues.push(
      location ? { severity, message: body.trim(), location } : { severity, message: body.trim() },
    );
  }

  const valid = /<rep:assessment>\s*<rep:accept\b/.test(report);
  return { file: xmlPath, valid, issues };
}

// defines a function that checks whether err is a Node.js error,
// and if it returns true, TypeScript will treat err as a NodeJS.ErrnoException.
// if it returns false, TypeScript does not narrow the type, so err remains unknown
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  // Return true only if err is an Error object and it has a code property
  return err instanceof Error && "code" in err;
}
