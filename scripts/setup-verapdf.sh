#!/usr/bin/env bash
# Downloads the veraPDF CLI (Java, IzPack-installed) into tools/verapdf/, and a portable JRE
# into tools/jre/ if neither that nor a system java is available. Version is pinned so
# validation results are reproducible across machines and CI.

# -e (Stop the script if a command fails)
# -u (Stop if you try to use a variable that does not exist)
# -o (If you have commands connected with |, treat the whole pipeline as failed if one command fails)
# Do not silently continue when something goes worng.
set -euo pipefail

# go to the root
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# veraPDF/veraPDF-apps — the CLI validator program. Ships as an IzPack GUI installer (not a
# plain runnable jar the way KoSIT's validator is), so installing it headlessly means feeding
# the installer jar an unattended XML profile instead of just downloading+unzipping a jar.
# veraPDF-apps has no GitHub Releases; software.verapdf.org is the real distribution point.
# 1.30.2 is the latest official release — odd minor versions (e.g. 1.31.x) are veraPDF's own
# convention for dev/CI snapshots, not releases.
VERAPDF_VERSION="1.30.2"
VERAPDF_RELEASE_DIR="1.30"
VERAPDF_INSTALLER_URL="https://software.verapdf.org/releases/${VERAPDF_RELEASE_DIR}/verapdf-greenfield-${VERAPDF_VERSION}-installer.zip"

# To download Java Runtime Environment (JRE), same pinned build scripts/setup-kosit.sh uses.
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.19%2B10/OpenJDK17U-jre_x64_linux_hotspot_17.0.19_10.tar.gz"

# Unlike setup-kosit.sh, this script needs a working `java` itself — to run the IzPack
# installer jar below — before veraPDF exists at all. Resolve one, preferring the JRE this
# project already pins (e.g. from a prior `make kosit-setup`) over an arbitrary system java,
# so the install stays reproducible across machines instead of depending on whatever JDK
# happens to be on someone's PATH.
if [ -x "tools/jre/bin/java" ]; then
  JAVA_BIN="$(pwd)/tools/jre/bin/java"
  echo "Using already-installed portable JRE: $JAVA_BIN"
# it is the same like 
# command -v java >/dev/null 2>/dev/null;
elif command -v java >/dev/null 2>&1; then
  JAVA_BIN="$(command -v java)"
  echo "No portable JRE at tools/jre/ yet — using java on PATH: $JAVA_BIN"
# -s (Silent)
# -L (follow redirects)
# -o (save to this filename)

# -x (Extract)
# -z (It is gzip comtressed)
# -f (Use this file)
# -C (Extract into blabla)
# --strip-components=1 (removes the archive's outer directory)
else
  echo "No java on PATH and no portable JRE yet — downloading one (no root required)..."
  mkdir -p tools/jre
  curl -sL -o /tmp/verapdf-jre.tar.gz "$JRE_URL"
  tar -xzf /tmp/verapdf-jre.tar.gz -C tools/jre --strip-components=1
  rm -f /tmp/verapdf-jre.tar.gz
  JAVA_BIN="$(pwd)/tools/jre/bin/java"
  echo "Portable JRE installed at tools/jre/bin/java"
fi

echo "Downloading veraPDF ${VERAPDF_VERSION} installer..."
curl -sL -o /tmp/verapdf-installer.zip "$VERAPDF_INSTALLER_URL"

rm -rf /tmp/verapdf-installer-extracted
# -o (overwrite files)
# -d (extract into this directory)
unzip -q -o /tmp/verapdf-installer.zip -d /tmp/verapdf-installer-extracted
rm -f /tmp/verapdf-installer.zip

# IzPack's AutomatedInstallation needs an absolute install path, so this profile is generated
# at run time rather than committed as a static file. Pack selection mirrors veraPDF's own
# docker-install.xml (used to build their official Docker image): CLI only, no GUI/docs/plugins.
INSTALL_DIR="$(pwd)/tools/verapdf"
rm -rf "$INSTALL_DIR"
# > (Send the output into a file)
# << (heredoc)
cat > /tmp/verapdf-auto-install.xml <<OPENINVOICEXML
<AutomatedInstallation langpack="eng">
    <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
    <com.izforge.izpack.panels.target.TargetPanel id="install_dir">
        <installpath>${INSTALL_DIR}</installpath>
    </com.izforge.izpack.panels.target.TargetPanel>
    <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
        <pack index="0" name="veraPDF GUI" selected="false"/>
        <pack index="1" name="veraPDF CLI" selected="true"/>
        <pack index="2" name="veraPDF Documentation" selected="false"/>
        <pack index="3" name="veraPDF Sample Plugins" selected="false"/>
    </com.izforge.izpack.panels.packs.PacksPanel>
    <com.izforge.izpack.panels.install.InstallPanel id="install"/>
    <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>
OPENINVOICEXML

echo "Installing veraPDF CLI into tools/verapdf/..."
"$JAVA_BIN" -jar "/tmp/verapdf-installer-extracted/verapdf-greenfield-${VERAPDF_VERSION}/verapdf-izpack-installer-${VERAPDF_VERSION}.jar" /tmp/verapdf-auto-install.xml

rm -rf /tmp/verapdf-installer-extracted /tmp/verapdf-auto-install.xml

echo "Done. Run 'make validate-verapdf' to validate generated PDFs."
