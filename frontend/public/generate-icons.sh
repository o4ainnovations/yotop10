#!/bin/sh
# Generate PWA icons — requires Imagemagick
# Run: brew install imagemagick && sh public/generate-icons.sh
convert -size 192x192 xc:'#05050f' -fill '#f97316' -gravity center -pointsize 80 -font Helvetica-Bold label:'Y' public/icon-192.png
convert -size 512x512 xc:'#05050f' -fill '#f97316' -gravity center -pointsize 200 -font Helvetica-Bold label:'Y' public/icon-512.png
