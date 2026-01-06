#!/bin/bash
for ttf in *.ttf; do
    ttf2woff "$ttf" "${ttf%ttf}woff"
    ttf2woff2 < "$ttf" > "${ttf%ttf}woff2"
done
