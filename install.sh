#!/bin/bash

set -e

# Configuration
APP_NAME="integrated-mod-manager-imm"
DISPLAY_NAME="Integrated Mod Manager (IMM)"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
UPDATE_URL="https://github.com/jpbhatt21/integrated-mod-manager/releases/latest/download/latest.json"
# Dependency check
for cmd in curl jq mktemp mkdir cp chmod; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required command '$cmd' is not installed."
    exit 1
  fi
done

# Fetch latest release JSON
echo "Fetching latest release information..."
RELEASE_JSON=$(curl -sL "$UPDATE_URL")

if [ -z "$RELEASE_JSON" ]; then
  echo "Error: Could not retrieve release info from $UPDATE_URL"
  exit 1
fi

# Detect OS / Package Manager
PKG_TYPE="appimage"

if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "$ID $ID_LIKE" in
    *debian*|*ubuntu*|*mint*|*pop*)
      if command -v dpkg >/dev/null 2>&1; then
        PKG_TYPE="deb"
      fi
      ;;
    *fedora*|*rhel*|*centos*|*suse*)
      if command -v rpm >/dev/null 2>&1; then
        PKG_TYPE="rpm"
      fi
      ;;
  esac
fi

# Install based on package type
case "$PKG_TYPE" in
  deb)
    DEB_URL=$(echo "$RELEASE_JSON" | jq -r '.platforms."linux-deb".url // empty')
    if [ -n "$DEB_URL" ] && [ "$DEB_URL" != "null" ]; then
      echo "Debian-based system detected. Installing .deb package..."
      TEMP_DEB=$(mktemp --suffix=.deb)
      curl -L -# "$DEB_URL" -o "$TEMP_DEB"
      sudo apt-get update -y && sudo apt-get install -y "$TEMP_DEB" || sudo dpkg -i "$TEMP_DEB"
      rm -f "$TEMP_DEB"
      echo "Installation complete!"
      exit 0
    fi
    ;;
  rpm)
    RPM_URL=$(echo "$RELEASE_JSON" | jq -r '.platforms."linux-rpm".url // empty')
    if [ -n "$RPM_URL" ] && [ "$RPM_URL" != "null" ]; then
      echo "RPM-based system detected. Installing .rpm package..."
      TEMP_RPM=$(mktemp --suffix=.rpm)
      curl -L -# "$RPM_URL" -o "$TEMP_RPM"
      if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y "$TEMP_RPM"
      else
        sudo rpm -i "$TEMP_RPM"
      fi
      rm -f "$TEMP_RPM"
      echo "Installation complete!"
      exit 0
    fi
    ;;
esac

# Fallback: AppImage Installation
APPIMAGE_URL=$(echo "$RELEASE_JSON" | jq -r '.platforms."linux-appimage".url // empty')

if [ -z "$APPIMAGE_URL" ] || [ "$APPIMAGE_URL" = "null" ]; then
  echo "Error: Could not retrieve AppImage download URL."
  exit 1
fi

echo "Installing via AppImage..."
TEMP_DIR=$(mktemp -d)
TEMP_APPIMAGE="$TEMP_DIR/$APP_NAME.AppImage"

curl -L -# "$APPIMAGE_URL" -o "$TEMP_APPIMAGE"

mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"

DEST_APPIMAGE="$INSTALL_DIR/$APP_NAME.AppImage"
mv "$TEMP_APPIMAGE" "$DEST_APPIMAGE"
chmod +x "$DEST_APPIMAGE"

cd "$TEMP_DIR"
"$DEST_APPIMAGE" --appimage-extract >/dev/null 2>&1 || true

if [ -d "squashfs-root" ]; then
  FOUND_ICON=$(find squashfs-root -maxdepth 2 \( -name "*.png" -o -name "*.svg" \) | head -n 1)
  if [ -n "$FOUND_ICON" ]; then
    cp "$FOUND_ICON" "$ICON_DIR/$APP_NAME.${FOUND_ICON##*.}"
  fi
  rm -rf squashfs-root
fi
cd - >/dev/null
rm -rf "$TEMP_DIR"

cat <<EOF > "$DESKTOP_DIR/$APP_NAME.desktop"
[Desktop Entry]
Name=$DISPLAY_NAME
Exec=$DEST_APPIMAGE
Icon=$APP_NAME
Type=Application
Terminal=false
Categories=Utility;
EOF

chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR"
fi

echo "Installation complete! $DISPLAY_NAME is now available in your application menu."