#!/bin/bash
# Start proxy server that handles both Flutter web AND API
cd "/Users/DekZ/Development/projects/app monitization/api_dynamic_artist_monetization"
exec node scripts/proxy-server.js
