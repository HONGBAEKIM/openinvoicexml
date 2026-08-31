#!/usr/bin/env bash
# Downloads the Mustang Project CLI (a single runnable jar, like KoSIT's validator — not
# IzPack-installed like veraPDF) into tools/mustang/, and a portable JRE into tools/jre/ if
# neither that nor a system java is available. Version is pinned so extraction/validation
# results are reproducible across machines and CI.
set -euo pipefail

# go to the root
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# ZUGFeRD/mustangproject — an independent, third-party e-invoicing CLI (extract/validate/combine)
# used here as a second opinion alongside KoSIT and veraPDF. GitHub Releases tags this jar's
# release as "core-<version>", not "Mustang-CLI-<version>" — confirmed via the Releases API,
# not assumed from the asset filename.
MUSTANG_VERSION="2.26.0"
MUSTANG_RELEASE_TAG="core-${MUSTANG_VERSION}"
MUSTANG_JAR_URL="https://github.com/ZUGFeRD/mustangproject/releases/download/${MUSTANG_RELEASE_TAG}/Mustang-CLI-${MUSTANG_VERSION}.jar"

# To download Java Runtime Environment (JRE), same pinned build scripts/setup-kosit.sh uses.
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.19%2B10/OpenJDK17U-jre_x64_linux_hotspot_17.0.19_10.tar.gz"

mkdir -p tools/mustang

echo "Downloading Mustang CLI ${MUSTANG_VERSION}..."
curl -sL -o tools/mustang/mustang-cli.jar "$MUSTANG_JAR_URL"

# Prefer a JRE this project already pinned (e.g. from a prior `make kosit-setup` or
# `make verapdf-setup`) over an arbitrary system java, same defensive check setup-verapdf.sh
# uses, since this may run before either of those.
if [ -x "tools/jre/bin/java" ]; then
  echo "Using already-installed portable JRE: $(pwd)/tools/jre/bin/java"
elif command -v java >/dev/null 2>&1; then
  echo "Using java on PATH: $(command -v java)"
else
  echo "No java on PATH and no portable JRE yet — downloading one (no root required)..."
  mkdir -p tools/jre
  curl -sL -o /tmp/mustang-jre.tar.gz "$JRE_URL"
  tar -xzf /tmp/mustang-jre.tar.gz -C tools/jre --strip-components=1
  rm -f /tmp/mustang-jre.tar.gz
  echo "Portable JRE installed at tools/jre/bin/java"
fi

echo "Done. Run 'make validate-mustang' to cross-check generated hybrid PDFs."
