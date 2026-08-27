# Friday Fish Fry Finder

Map + filterable list of every Friday fish fry in Marathon County, published
by the [Wausau Pilot & Review](https://wausaupilotandreview.com). Data is
curated in a Google Sheet, validated and geocoded by `build/build.py`, and
served as a static widget from GitHub Pages.

Architecture, the sheet contract, and curator workflow live in
[CLAUDE.md](CLAUDE.md).

## Embedding in WordPress

Two parts, deliberately separate: wausaupilotandreview.com's security layer
rejects `<script>` tags inside article content (the save fails with
"Updating failed. The response is not a valid JSON response"), so the
height listener is installed **once, site-wide**, and each article carries
only the iframe.

**Part 1 — once per site** (admin): add the listener to the site footer via
the snippets plugin (WPCode → "Insert Headers and Footers", footer section)
or the theme's custom-JS slot. It finds every fish-fry iframe by `src`, so
articles don't need ids and existing embeds are covered retroactively.

```html
<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://rowanflynnpilot.github.io") return;
    if (!e.data || e.data.type !== "wpr-fish-fry:height") return;
    document
      .querySelectorAll('iframe[src^="https://rowanflynnpilot.github.io/wpr-fish-fry"]')
      .forEach(function (f) { f.style.height = e.data.height + "px"; });
  });
</script>
```

**Part 2 — in each article**: a **Custom HTML** block with only the iframe.

```html
<iframe
  src="https://rowanflynnpilot.github.io/wpr-fish-fry/"
  style="width: 100%; border: 0;"
  height="900"
  title="Friday Fish Fry Finder"
  loading="lazy"
></iframe>
```

The `height="900"` attribute is only the pre-JavaScript fallback; the
listener takes over on first paint. The widget reports its height with
`postMessage`, so the frame resizes itself and never shows an inner
scrollbar.

### No-setup alternative: the compact embed

When Part 1 isn't an option, `embed.html` is a layout **designed for a
fixed frame** — map and filters stay pinned, the venue list scrolls in its
own panel, and an "Open the full guide" link escapes to the standalone
page. One Custom HTML block, no script anywhere, saves first try:

```html
<iframe
  src="https://rowanflynnpilot.github.io/wpr-fish-fry/embed.html"
  style="width: 100%; border: 0;"
  height="1100"
  title="Friday Fish Fry Finder"
  loading="lazy"
></iframe>
```

Demo harness: [embed-compact-test.html](https://rowanflynnpilot.github.io/wpr-fish-fry/embed-compact-test.html)
fakes an article around it, script-free, the way WordPress will see it.

To see the contract working before touching WordPress, open
[the embed test page](https://rowanflynnpilot.github.io/wpr-fish-fry/embed-test.html)
— it wraps the widget in a fake article using this exact snippet.

## Development

```powershell
# data build against the sample (or paste the sheet CSV URL)
python build/build.py sample/fish_fry_sample.csv

# widget dev server / production build
cd widget; npm install; npm run dev
cd widget; npm run build
```
