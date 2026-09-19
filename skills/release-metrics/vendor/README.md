# Vendor — Chart.js

`chart.min.js` (Chart.js 4.4.3, ~201 KB) ships with the plugin. No setup needed.

The release-metrics skill reads this file and embeds it inline in every generated HTML
report, making reports fully self-contained — no internet required to open them.

## Re-download (if file is missing or corrupted)

```bash
node fetch-vendor.js
```

Downloads Chart.js 4.4.3 minified from jsDelivr CDN and saves it here. Run from this
directory or as `node $PLUGIN_DIR/skills/release-metrics/vendor/fetch-vendor.js` from
any location.

## Why vendor and not CDN?

The generated HTML reports are designed to be attached and shared (email, Teams,
SharePoint). Recipients should not need internet access to view charts. Embedding
Chart.js inline removes that dependency entirely.
