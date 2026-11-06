# St. George Spirits — homepage design concept

An **unofficial, non-commercial design concept**. This is a portfolio piece exploring
scroll-driven video, physics-based product browsing and cross-document View Transitions.

> **Not affiliated with, endorsed by, or connected to St. George Spirits, Inc.**
> Product names, label artwork, photography and marketing copy belong to St. George
> Spirits, Inc. and are reproduced here only to illustrate the design. Nothing on the
> site is an offer to sell alcoholic beverages. The deployment is served `noindex`.

If you represent St. George Spirits and would like this taken down, open an issue and
it will be removed.

## Build

None. Static HTML, CSS and JS — open `index.html` or serve the folder:

```bash
python3 -m http.server 4477
```

## Notable bits

- `assets/video/hero-720.mp4` — the hero clip, trimmed to 5.2s and encoded at 2400 kbps
  (1.6 MB). An HEVC sibling is offered first for Safari. The film is paced with
  `playbackRate` and parked on an exact frame; see the comments in `index.html`.
- `assets/js/site.js` — shared header/nav/reveal, an opt-in WebAudio sound layer
  (nothing is fetched until the toggle is switched on), and the View Transitions wiring.
- `spirits/*.html` — product pages. The bottle animates from the shelf into the page hero.
