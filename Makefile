.ONESHELL:
.PHONY: test type lint generate validate-xml kosit-setup validate-kosit

all: lint type test

test:
	npm test

type:
	npm run typecheck

lint:
	npm run lint

generate:
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
	import { toXRechnung } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length));
	mkdirSync("dist/xml", { recursive: true });
	for (const n of names) {
	  const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	  writeFileSync("dist/xml/" + n + ".xml", toXRechnung(inv));
	}
	EOF

# only check is it xml file or not with first "<?xml"
validate-xml: generate
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync } from "fs";
	for (const f of readdirSync("dist/xml").filter(f => f.endsWith(".xml"))) {
	  const xml = readFileSync("dist/xml/" + f, "utf8");
	  if (!xml.startsWith("<?xml")) throw new Error(f + ": missing XML declaration");
	  console.log("✓ " + f);
	}
	EOF

# one-time download of the KoSIT validator jar + XRechnung scenario config (+ a
# portable JRE if java isn't already on PATH) into tools/ (git-ignored)
kosit-setup:
	bash scripts/setup-kosit.sh

# generates XML from all fixtures, then runs it through the real KoSIT validator;
# exits non-zero if any file has an error-severity Schematron/XSD finding
# Only filters "error"

# and expected output will be
# ✗ dist/xml/invoice1.xml — 2 error(s)
#     Missing BuyerReference
#     Seller VAT ID missing
# ✓ dist/xml/invoice2.xml
validate-kosit: generate
	node --input-type=module <<'EOF'
	import { runKosit } from "./dist/validators/index.js";
	import { readdirSync } from "fs";
	const files = readdirSync("dist/xml").filter(f => f.endsWith(".xml")).map(f => "dist/xml/" + f);
	const results = runKosit(files);
	let failed = false;
	for (const r of results) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) failed = true;
	}
	if (failed) process.exit(1);
	EOF