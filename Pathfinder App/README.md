# Pathfinder

Map-based job discovery for university students. Vanilla HTML/CSS/JS — no build step, no dependencies.

## Run locally

**Serve it — don't open the file directly.** Geolocation requires a secure context, and `file://` doesn't qualify:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

`localhost` counts as secure, so location works there.

## Deploy

Drag the folder onto [netlify.com/drop](https://app.netlify.com/drop) — live in about ten seconds, free, with HTTPS (which geolocation needs). GitHub Pages works too.

---

## Latest round

### The black box at the bottom of the screen

The toast notification. It was hidden by pushing it down `translateY(120%)` — 120% of *its own height*. An empty toast is only ~21px tall, so it moved 25px against a `bottom: 1.5rem` (24px) offset, leaving roughly 20px of black bar permanently stuck to the bottom of the viewport. It also had `.toast[hidden] { display: block }`, which defeated the `hidden` attribute meant to keep it out of the layout.

Now hidden with `opacity` + `visibility` and a fixed 12px offset, so its height can't affect whether it's concealed.

### Drag to pan

Pointer-events based, so mouse, trackpad, touch, and stylus all work through one code path.

- Drag anywhere on the map to pan; cursor switches to `grab`/`grabbing`.
- Scroll wheel zooms, anchored to the cursor position — the point under your pointer stays put as you scale, which is what every map does and what feels wrong when it's missing.
- Arrow keys pan and `+`/`-` zoom, so it isn't mouse-only.
- Panning is clamped to ~a quarter viewport of travel at 1x, scaling up as you zoom. The decorative layers (grid, roads, water) extend well past the canvas so you never drag into an empty edge.

One subtlety worth knowing about: a drag that starts on top of a pin would otherwise fire that pin's click when you release. There's a 4px movement threshold — past it the gesture is a pan and the click is suppressed.

### Geolocation

Added, but it required making the map geographically real first.

The original map was decorative — pin positions were hand-picked percentages. Dropping a "you are here" dot on that would have been meaningless, since no position on the map corresponded to any actual place. So each job now carries real lat/lng, and pin positions are *derived* by projecting those coordinates into a bounding box around UCSD:

```
north: 32.925   south: 32.815
west: -117.300  east:  -117.170
```

That makes the map internally consistent — Sorrento Valley sits north of UTC, which sits north of La Jolla, and La Jolla hugs the coastline. Verified numerically, along with the Haversine distance function against four known real-world distances.

Behavior:

- Fires only on button click. Browsers increasingly refuse permission prompts without a user gesture, and asking on page load is a good way to get permanently denied.
- Places a pulsing dot and recenters the map, if you're inside the bounds.
- Outside the bounds, skips the dot and tells you how far the nearest job is — distances stay correct anywhere on Earth even though the dot only makes sense locally.
- Unlocks a "Nearest first" sort. Distances appear on the detail panel, list cards, and saved jobs.
- Handles all three `PositionError` codes distinctly, plus missing API and insecure context.

The two remote roles carry no coordinates and get no pin — they appear in the list only, and the result count says how many are remote. Inventing a map location for a remote job would be a lie.

---

## Earlier round

**The stylesheet never loaded.** `index.html` linked `styles.css`; the file was `style.css`. Every visitor saw unstyled HTML.

**No viewport meta tag**, plus `min-width: 1100px` on `html, body` — guaranteed horizontal scrolling on every phone.

**Template metadata** replaced with a real title, description, Open Graph tags, and an inline SVG favicon.

**Responsive rebuild**, mobile-first with one breakpoint at 768px. On mobile: fixed search header, compact map, scrollable job list beneath — a pin map is hard to use with a thumb, so the list leads and the map gives context. On desktop: full-bleed map with floating panels.

**Every control was dead.** Search, the three tool buttons, Apply, and Edit Profile did nothing; the bell fired an `alert`. All functional now, plus type filter chips.

**Persistence** for saved jobs and profile via `localStorage`, every access guarded — an unguarded call throws in Safari private mode and would kill the script on load.

**Real data** replacing the placeholder listings, with pay ranges, ISO close dates, and computed deadlines ("Closes in 3 days" in red) instead of a hardcoded `Apply by M/D/YY`.

**Accessibility:**

- Pins announced as "•" or nothing → now labeled *"Software Engineer Intern at Pacific Systems, Sorrento Valley, CA"* with `aria-pressed` state
- 18px touch targets → 44px hit areas (WCAG minimum is 24px)
- No focus styles anywhere → consistent visible focus ring
- Nav → ARIA tabs pattern with arrow-key navigation and focus management
- Brand blue gave white text 3.31:1 against a 4.5:1 requirement → darkened to `#3f6fd8` (4.69:1); all 12 palette pairs now pass
- Skip link, live regions, `prefers-reduced-motion`

**Code quality:** `var` and index loops → `const`/`let` and array methods. All DOM construction goes through a `textContent` helper; the original used `innerHTML` string concatenation for saved-job cards, which is fine for hardcoded data but becomes an XSS hole the moment listings come from an API.

---

## Verified

Static checks, all passing:

- JS parses clean; no `innerHTML` remaining
- Every element ID, class selector, form field name, label target, and `aria-controls` reference resolves
- CSS braces balanced, no malformed values
- 8 listings, unique IDs, no past deadlines, filter chips aligned to job types
- All pins project on-map, adequately separated, none in the ocean, north-south ordering geographically correct
- Haversine validated against four known distances
- All 12 color pairs pass WCAG AA
- Toast regression test: no percentage transform, no `display:block` override

**Not verified:** I couldn't render it — no browser in the sandbox and the Chrome extension isn't connected. Please confirm by hand:

1. Drag the map; check it doesn't reveal empty edges at the extremes
2. Click a pin *without* dragging, then drag starting on a pin — the first should open details, the second shouldn't
3. Serve over `localhost` and click the locate button
4. Resize below 768px and confirm the map/list split

## If you take it further

Swap the `JOBS` array for a `fetch` — the render functions already take data as input, so only the source changes. Then real map tiles (Leaflet + OpenStreetMap is free and would replace the projection code with something battle-tested), `watchPosition` for live tracking, and deadline reminders on saved jobs.
