# Pathfinder

Map-based job discovery for university students. Vanilla HTML/CSS/JS — no build step, no dependencies.

## Run locally

Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
```

## Deploy

Drag the folder onto [netlify.com/drop](https://app.netlify.com/drop) — it's live in about ten seconds, free, with HTTPS. GitHub Pages works too: push the folder, then Settings → Pages → deploy from `main`.

---

## What changed

### Blocking bugs

**The stylesheet never loaded.** `index.html` linked `styles.css`; the file was `style.css`. Every visitor saw unstyled HTML. This was the single highest-impact fix.

**No viewport meta tag**, plus `min-width: 1100px` on `html, body`. Together these guaranteed a horizontally-scrolling, zoomed-out mess on every phone. Both removed.

**Template metadata.** Added a real title, description, Open Graph tags, and an inline SVG favicon so link previews and browser tabs look intentional.

### Responsive layout

Rebuilt mobile-first with one breakpoint at 768px.

- **Mobile:** search and filters sit in a fixed header, a compact map occupies the top 38% of the viewport, and a scrollable job list fills the rest. A pin map is genuinely hard to use with a thumb — the list is the primary interface at that size and the map is context.
- **Desktop:** full-bleed map, floating control panel top-left, tool cluster top-right, detail card bottom-left.

The detail panel slides up as a bottom sheet on mobile and fades in as a card on desktop — same markup, different presentation.

### Dead controls, now functional

Every control in the original either did nothing or fired an `alert`:

| Control | Before | After |
|---|---|---|
| Search input | Not wired to anything | Live filter across title, company, location, type, tags |
| Filter/refresh/locate buttons | Decorative | Zoom in, zoom out, reset view |
| — | — | Added filter chips: All / Internships / Part-time / Full-time |
| Apply button | Did nothing silently | Toast explaining it's a prototype |
| Edit Profile button | Did nothing | Removed; the form is directly editable and saves |
| Notification bell | `alert("not implemented")` | Real modal with focus management and Escape-to-close |
| Save button | Save-only, no undo | Toggles, with saved state reflected on the map pin |

### Data and persistence

Saved jobs and profile now persist to `localStorage`, so a recruiter clicking around doesn't lose state on refresh. Every storage access is wrapped in try/catch — `localStorage` throws in Safari private mode, and an unguarded call would have killed the whole script on load.

Replaced the placeholder listings (the ones your comment flagged as "random words that sound like a job") with eight plausible ones carrying pay ranges, real ISO close dates, and resume requirements. Deadlines are computed against the current date, so a listing closing in three days shows "Closes in 3 days" in red rather than a hardcoded `Apply by M/D/YY`. Saved jobs sort by soonest deadline.

A banner marks the data as sample so nobody mistakes it for a live job board.

### Accessibility

The original was unusable by keyboard and opaque to screen readers.

- **Map pins** announced as "•" or nothing. They now have labels like *"Software Engineer Intern at Pacific Systems, Sorrento Valley, CA"*, plus `aria-pressed` for selection state.
- **Touch targets** were 18px. Now 44px hit areas with a smaller visual dot — the WCAG minimum is 24px.
- **No focus styles at all.** Added a consistent visible focus ring throughout.
- **Nav** now implements the ARIA tabs pattern with arrow-key navigation, and moves focus into the panel on switch.
- **Contrast:** the brand blue `#5b8af0` gave white text 3.31:1, below the 4.5:1 minimum. Darkened to `#3f6fd8` (4.69:1). All twelve foreground/background pairs in the palette now pass — verified numerically, not by eye.
- Added a skip link, live regions for result counts and toasts, and a `prefers-reduced-motion` block.

### Code quality

Rewrote from `var` and index loops to `const`/`let` and array methods. All DOM construction goes through a `textContent`-based helper — the original built saved-job cards with `innerHTML` string concatenation, which is fine for hardcoded data but becomes an XSS hole the moment listings come from an API. Worth closing now rather than remembering later.

---

## Verified

- JS parses clean (`node --check`)
- All 26 element IDs, 5 class selectors, 5 form field names, 7 label targets, and 4 `aria-controls` references resolve against the markup
- CSS braces balanced, no malformed values
- Job data: 8 unique IDs, no overlapping pin coordinates, no pins off-canvas, filter chips and job types fully aligned, no listings with past deadlines
- All 12 color pairs pass WCAG AA

**Not verified:** I couldn't render it in a browser — the sandbox has no browser and the Chrome extension wasn't connected. Checks above are static. Before deploying, open it yourself and confirm the map layout at both widths and that the bottom sheet animates cleanly on a phone.

## If you take it further

The obvious next step is real data — swap the `JOBS` array for a `fetch` against a job board API. `renderMarkers` and `renderMobileList` already take data as input, so only the source changes. Beyond that: real map tiles (Leaflet + OpenStreetMap is free), deadline reminders, and application status tracking on saved jobs.
