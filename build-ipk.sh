#!/bin/sh
# Build an IPK package for the Concentric Clock screensaver
# Usage: ./build-ipk.sh
# Output: com.custom.screensaver_1.0.0.ipk

set -e

APP_ID="com.custom.screensaver"
VERSION="1.0.0"
IPK_NAME="${APP_ID}_${VERSION}.ipk"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$(mktemp -d)"
INSTALL_DIR="$BUILD_DIR/data/media/developer/apps/usr/palm/applications/$APP_ID"

# Create directory structure
mkdir -p "$INSTALL_DIR"
mkdir -p "$BUILD_DIR/control"

# Copy app files
cp "$SCRIPT_DIR/appinfo.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/index.html" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/clock.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/style.css" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/icon.png" "$INSTALL_DIR/"

# Create control file
cat > "$BUILD_DIR/control/control" << EOF
Package: $APP_ID
Version: $VERSION
Section: misc
Priority: optional
Architecture: all
Maintainer: i5dr0id
Description: Concentric clock screensaver for LG webOS TV
Source: https://github.com/i5dr0id/lg-screensaver
EOF

cat > "$BUILD_DIR/control/postinst" << 'EOF'
#!/bin/sh
exit 0
EOF
chmod 755 "$BUILD_DIR/control/postinst"

cat > "$BUILD_DIR/control/prerm" << 'EOF'
#!/bin/sh
exit 0
EOF
chmod 755 "$BUILD_DIR/control/prerm"

# Create debian-binary
printf "2.0\n" > "$BUILD_DIR/debian-binary"

# Create control.tar.gz (COPYFILE_DISABLE suppresses macOS ._ resource forks)
(cd "$BUILD_DIR/control" && COPYFILE_DISABLE=1 tar czf "$BUILD_DIR/control.tar.gz" ./control ./postinst ./prerm)

# Create data.tar.gz
(cd "$BUILD_DIR/data" && COPYFILE_DISABLE=1 tar czf "$BUILD_DIR/data.tar.gz" .)

# Build IPK as an AR archive manually (macOS ar mangles non-Mach-O members)
python3 -c "
import struct, os, time

def ar_header(name, size):
    now = str(int(time.time())).encode()
    h  = name.ljust(16)
    h += now.ljust(12)
    h += b'0'.ljust(6)
    h += b'0'.ljust(6)
    h += b'100644'.ljust(8)
    h += str(size).encode().ljust(10)
    h += b'\x60\x0a'
    return h

build = '$BUILD_DIR'
out = b'!<arch>\n'
for fname in ['debian-binary', 'control.tar.gz', 'data.tar.gz']:
    path = os.path.join(build, fname)
    data = open(path, 'rb').read()
    out += ar_header(fname.encode(), len(data))
    out += data
    if len(data) % 2:
        out += b'\n'

with open('$SCRIPT_DIR/$IPK_NAME', 'wb') as f:
    f.write(out)
"

# Clean up
rm -rf "$BUILD_DIR"

echo "Built: $IPK_NAME"
ls -lh "$SCRIPT_DIR/$IPK_NAME"
