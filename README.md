# Friday Fish Fry Finder

Map + filterable list of every Friday fish fry in Marathon County, published
by the [Wausau Pilot & Review](https://wausaupilotandreview.com). Data is
curated in a Google Sheet, validated and geocoded by `build/build.py`, and
served as a static widget from GitHub Pages.

Architecture, the sheet contract, and curator workflow live in
[CLAUDE.md](CLAUDE.md).

## Embedding in WordPress

Add a **Custom HTML** block with the snippet below. The widget reports its
height to the parent page (`postMessage`), so the iframe resizes itself and
never shows an inner scrollbar.

```html
<iframe
  id="wpr-fish-fry"
  src="https://rowanflynnpilot.github.io/wpr-fish-fry/"
  style="width: 100%; border: 0;"
  height="900"
  title="Friday Fish Fry Finder"
  loading="lazy"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://rowanflynnpilot.github.io") return;
    if (e.data && e.data.type === "wpr-fish-fry:height") {
      document.getElementById("wpr-fish-fry").style.height =
        e.data.height + "px";
    }
  });
</script>
```

The `height="900"` attribute is only the pre-JavaScript fallback; the
listener takes over on first paint.

## Development

```powershell
# data build against the sample (or paste the sheet CSV URL)
python build/build.py sample/fish_fry_sample.csv

# widget dev server / production build
cd widget; npm install; npm run dev
cd widget; npm run build
```
