#!/bin/bash
set -e

FLUTTER_DIR="/Users/DekZ/Development/projects/app monitization/dynamic_artist_monetization"
BUILD_DIR="$FLUTTER_DIR/build/web"

echo "Building Flutter web..."
cd "$FLUTTER_DIR"
flutter build web --release

echo "Downloading CanvasKit and fonts..."
cd "$BUILD_DIR"
mkdir -p canvaskit fonts

curl -s -o canvaskit/canvaskit.js https://www.gstatic.com/flutter-canvaskit/1527ae0ec577a4ef50e65f6fefcfc1326707d9bf/chromium/canvaskit.js
curl -s -o canvaskit/canvaskit.wasm https://www.gstatic.com/flutter-canvaskit/1527ae0ec577a4ef50e65f6fefcfc1326707d9bf/chromium/canvaskit.wasm
curl -s -o fonts/Roboto-Regular.woff2 "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me4GZLCzYlKw.woff2"

echo "Patching flutter_bootstrap.js..."
# Replace the entire minified line with our patched version
python3 << 'PYTHON_SCRIPT'
import re

with open('flutter_bootstrap.js', 'r') as f:
    content = f.read()

# Replace function T to always return /canvaskit/
content = re.sub(
    r'function T\(i,e\)\{return i\.canvasKitBaseUrl\?i\.canvasKitBaseUrl:e\.engineRevision&&!e\.useLocalCanvasKit\?I\("https://www\.gstatic\.com/flutter-canvaskit",e\.engineRevision\):"canvaskit"\}',
    'function T(i,e){return "/canvaskit/"}',
    content
)

# Remove chromium subdirectory logic
content = re.sub(
    r'e\.canvasKitVariant=="experimentalWebParagraph"\?a=c\(a,"experimental_webparagraph"\):s&&\(a=c\(a,"chromium"\)\);',
    '',
    content
)

# Add explicit config
content = re.sub(
    r'_flutter\.loader\.load\(\{',
    '_flutter.loader.load({\n  config: { canvasKitBaseUrl: "/canvaskit/" },',
    content
)

with open('flutter_bootstrap.js', 'w') as f:
    f.write(content)

print("Patched successfully!")
PYTHON_SCRIPT

# Add font CSS to index.html
if ! grep -q "Roboto" index.html; then
    sed -i '' '/<\/head>/i\
  <style>\
    @font-face {\
      font-family: '\''Roboto'\'';\
      font-style: normal;\
      font-weight: 400;\
      src: url('\''fonts/Roboto-Regular.woff2'\'') format('\''woff2'\'');\
    }\
  </style>\
' index.html
fi

echo "Copying build to API workspace..."
API_DIR="/Users/DekZ/Development/projects/app monitization/api_dynamic_artist_monetization"
rm -rf "$API_DIR/web-build"
cp -r "$BUILD_DIR" "$API_DIR/web-build"

echo "Build copied! Restarting PM2..."
cd "$API_DIR"
pm2 restart flutter-web

echo "✅ Done! Access at https://caryl-exertive-treva.ngrok-free.dev/"
