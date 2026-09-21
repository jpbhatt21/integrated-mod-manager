#!/usr/bin/env bash
# Pre-seeds the linuxdeploy GTK plugin the Tauri bundler would otherwise download (#33, #37).
set -euo pipefail

PLUGIN_COMMIT="dda522bce37387f1b853d9095713bfaa924c8423"
PLUGIN_URL="https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/${PLUGIN_COMMIT}/linuxdeploy-plugin-gtk.sh"
PLUGIN="${XDG_CACHE_HOME:-$HOME/.cache}/tauri/linuxdeploy-plugin-gtk.sh"

mkdir -p "$(dirname "$PLUGIN")"
curl -fsSL "$PLUGIN_URL" -o "$PLUGIN"

grep -q '^export GDK_BACKEND=x11' "$PLUGIN"
sed -i 's|^export GDK_BACKEND=x11|export GDK_BACKEND="${GDK_BACKEND:-x11}"|' "$PLUGIN"

cat >> "$PLUGIN" <<'EOF'

echo "Removing bundled libwayland (must match the host Mesa/EGL)"
find "$APPDIR"/usr/lib* \( -type f -o -type l \) \
    \( -name 'libwayland-client.so*' -o -name 'libwayland-cursor.so*' -o -name 'libwayland-egl.so*' -o -name 'libwayland-server.so*' \) \
    -print -delete

echo "Removing uim IM module (fatal when uim is not installed on the host)"
find "$APPDIR" \( -type f -o -type l \) -name 'im-uim.so' -print -delete
find "$APPDIR" -type f -name 'immodules.cache' -exec sed -i '/im-uim\.so"/,/^$/d' '{}' \;
EOF

chmod +x "$PLUGIN"
echo "Patched $PLUGIN"
