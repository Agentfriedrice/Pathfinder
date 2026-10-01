/* ============================================================
   Pathfinder
   Vanilla JS, no build step, no dependencies.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   MAP PROJECTION
   The stylized map now covers a real geographic box around UCSD.
   Pin positions are derived from lat/lng rather than hand-placed,
   which is what makes "show my location" meaningful — the user dot
   lands in a position that is actually correct relative to the jobs.
   ------------------------------------------------------------ */

const MAP_BOUNDS = {
  north:  32.925,
  south:  32.815,
  west:  -117.300,
  east:  -117.170
};

/** lat/lng -> percentage position on the map canvas. */
function project(lat, lng) {
  return {
    left: ((lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 100,
    top:  ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 100
  };
}

function withinBounds(lat, lng) {
  return lat >= MAP_BOUNDS.south && lat <= MAP_BOUNDS.north &&
         lng >= MAP_BOUNDS.west  && lng <= MAP_BOUNDS.east;
}

/** Great-circle distance in miles. */
function haversineMiles(a, b) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function formatDistance(miles) {
  if (miles < 0.1) return "here";
  if (miles < 10)  return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

/* ------------------------------------------------------------
   DATA
   Remote roles carry no coordinates and therefore no map pin —
   they appear in the list only, which is the honest treatment.
   ------------------------------------------------------------ */

const JOBS = [
  {
    id: "fe-coastline",
    title: "Front-End Developer",
    company: "Coastline Studio",
    type: "Full Time",
    location: "Sorrento Valley, CA",
    pay: "$85k–$105k",
    tags: ["React", "TypeScript", "Accessibility"],
    description:
      "Build marketing sites and internal tools for mid-size clients. Small team, high ownership, heavy emphasis on accessible markup.",
    closes: "2026-07-24",
    resumeRequired: true,
    lat: 32.9010, lng: -117.1960
  },
  {
    id: "swe-pacific",
    title: "Software Engineer Intern",
    company: "Pacific Systems",
    type: "Internship",
    location: "Sorrento Valley, CA",
    pay: "$32/hr",
    tags: ["Backend", "Go", "APIs"],
    description:
      "Build and maintain backend services for a logistics platform. You'll write tests, take part in code reviews, and ship to production in your first month.",
    closes: "2026-08-15",
    resumeRequired: true,
    lat: 32.8985, lng: -117.2033
  },
  {
    id: "lab-bioscope",
    title: "Lab Operations Assistant",
    company: "Bioscope Research",
    type: "Part Time",
    location: "UTC, San Diego",
    pay: "$22/hr",
    tags: ["Lab", "Inventory", "On-site"],
    description:
      "Keep lab inventory stocked, prep equipment for experiments, and log sample data. No prior lab experience required.",
    closes: "2026-08-30",
    resumeRequired: false,
    lat: 32.8760, lng: -117.2180
  },
  {
    id: "ds-analytics",
    title: "Data Science Intern",
    company: "Analytics Lab",
    type: "Internship",
    location: "UTC, San Diego",
    pay: "$29/hr",
    tags: ["Python", "SQL", "Visualization"],
    description:
      "Analyze product usage datasets, build baseline models, and present findings to the product team every other week.",
    closes: "2026-07-29",
    resumeRequired: true,
    lat: 32.8705, lng: -117.2115
  },
  {
    id: "cashier-taco",
    title: "Cashier",
    company: "The Taco Stand",
    type: "Part Time",
    location: "La Jolla, CA",
    pay: "$18/hr + tips",
    tags: ["Customer Service", "On-site", "Flexible hours"],
    description:
      "Serve customers, handle payments, and support day-to-day operations. Shifts scheduled around class times.",
    closes: "2026-08-22",
    resumeRequired: false,
    lat: 32.8480, lng: -117.2740
  },
  {
    id: "ux-harborline",
    title: "UX Research Assistant",
    company: "Harborline Health",
    type: "Part Time",
    location: "La Jolla, CA",
    pay: "$26/hr",
    tags: ["Interviews", "Figma", "Synthesis"],
    description:
      "Support a two-person research team running usability sessions on a patient scheduling tool. Recruiting, note-taking, and synthesis.",
    closes: "2026-08-04",
    resumeRequired: true,
    lat: 32.8380, lng: -117.2680
  },
  {
    id: "pm-triton",
    title: "Associate Product Manager",
    company: "Triton Apps",
    type: "Full Time",
    location: "Remote",
    pay: "$78k–$92k",
    tags: ["Product", "Roadmapping", "Analytics"],
    description:
      "Work with design and engineering to scope features, write specs, and track outcomes after launch. New-grad friendly, structured onboarding.",
    closes: "2026-09-01",
    resumeRequired: true,
    lat: null, lng: null
  },
  {
    id: "mkt-tidepool",
    title: "Marketing Intern",
    company: "Tidepool Media",
    type: "Internship",
    location: "Remote",
    pay: "$21/hr",
    tags: ["Social", "Copywriting", "Analytics"],
    description:
      "Draft social copy, schedule posts, and report on channel performance for three consumer brands.",
    closes: "2026-08-11",
    resumeRequired: false,
    lat: null, lng: null
  }
];

const STORAGE_KEYS = {
  saved:   "pathfinder.savedJobs.v1",
  profile: "pathfinder.profile.v1"
};

/* ------------------------------------------------------------
   STORAGE
   localStorage throws in Safari private mode and when disabled by
   policy. Every access is guarded so the app degrades to in-memory
   rather than dying on load.
   ------------------------------------------------------------ */

const storage = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.warn("Storage read failed; using in-memory state.", err);
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("Storage write failed; changes will not persist.", err);
      return false;
    }
  }
};

/* ------------------------------------------------------------
   STATE
   ------------------------------------------------------------ */

const state = {
  savedIds: storage.get(STORAGE_KEYS.saved, []).filter(id => JOBS.some(j => j.id === id)),
  currentJobId: null,
  query: "",
  filter: "all",
  zoom: 1,
  pan: { x: 0, y: 0 },
  userLocation: null,       // { lat, lng, accuracy }
  sortByDistance: false
};

const jobById = id => JOBS.find(j => j.id === id);
const mappableJobs = () => JOBS.filter(j => j.lat !== null);

/* ------------------------------------------------------------
   DOM REFS
   ------------------------------------------------------------ */

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const els = {
  navLinks:      $$(".nav-link"),
  views:         $$(".view"),
  navBadge:      $("#navSavedBadge"),

  searchInput:   $("#searchInput"),
  clearSearch:   $("#clearSearch"),
  chips:         $$(".chip"),
  resultCount:   $("#resultCount"),
  sortToggle:    $("#sortToggle"),

  mapArea:       $("#mapArea"),
  mapCanvas:     $("#mapCanvas"),
  mapHint:       $("#mapHint"),
  markerLayer:   $("#markerLayer"),
  userMarker:    $("#userMarker"),
  locateBtn:     $("#locateMe"),
  mobileList:    $("#mobileList"),

  detailsBox:    $("#jobDetailsBox"),
  detailsContent:$("#jobDetailsContent"),
  closeDetails:  $("#closeDetails"),
  saveJobButton: $("#saveJobButton"),

  savedCount:    $("#savedCount"),
  savedContainer:$("#savedJobsContainer"),

  notifButton:   $("#notifButton"),
  notifPanel:    $("#notifPanel"),
  closeNotif:    $("#closeNotif"),

  profileForm:   $("#profileForm"),
  profileStatus: $("#profileStatus"),
  bioCount:      $("#bioCount"),

  toast:         $("#toast")
};

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

/** Build an element. Uses textContent throughout — never innerHTML
 *  with job data, so listings can safely come from an API later. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function daysUntil(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(isoDate + "T00:00:00") - today) / 86400000);
}

function deadlineLabel(isoDate) {
  const days = daysUntil(isoDate);
  const pretty = new Date(isoDate + "T00:00:00")
    .toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (days < 0)   return { text: "Closed",                  urgent: false };
  if (days === 0) return { text: "Closes today",            urgent: true };
  if (days === 1) return { text: "Closes tomorrow",         urgent: true };
  if (days <= 7)  return { text: `Closes in ${days} days`,  urgent: true };
  return { text: `Apply by ${pretty}`, urgent: false };
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2800);
}

const isSaved = id => state.savedIds.includes(id);

/** Distance from the user to a job, or null if either is unknown. */
function distanceTo(job) {
  if (!state.userLocation || job.lat === null) return null;
  return haversineMiles(state.userLocation, { lat: job.lat, lng: job.lng });
}

/* ------------------------------------------------------------
   NAVIGATION
   ------------------------------------------------------------ */

function switchView(targetId) {
  els.navLinks.forEach(link => {
    const on = link.dataset.target === targetId;
    link.classList.toggle("active", on);
    link.setAttribute("aria-selected", String(on));
  });

  els.views.forEach(view => view.classList.toggle("active-view", view.id === targetId));

  // Move focus to the panel so screen readers and keyboard users land
  // in the new content instead of staying on the tab.
  const panel = document.getElementById(targetId);
  if (panel) panel.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

els.navLinks.forEach((link, index) => {
  link.addEventListener("click", () => switchView(link.dataset.target));

  // Arrow-key navigation between tabs, per the ARIA tabs pattern.
  link.addEventListener("keydown", event => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
    if (!(event.key in moves)) return;
    event.preventDefault();

    const move = moves[event.key];
    const next = move === "first" ? 0
               : move === "last"  ? els.navLinks.length - 1
               : (index + move + els.navLinks.length) % els.navLinks.length;

    els.navLinks[next].focus();
    switchView(els.navLinks[next].dataset.target);
  });
});

/* ------------------------------------------------------------
   FILTERING + SORTING
   ------------------------------------------------------------ */

function visibleJobs() {
  const q = state.query.trim().toLowerCase();

  const matched = JOBS.filter(job => {
    if (state.filter !== "all" && job.type !== state.filter) return false;
    if (!q) return true;
    return [job.title, job.company, job.location, job.type, ...job.tags]
      .join(" ").toLowerCase().includes(q);
  });

  if (state.sortByDistance && state.userLocation) {
    return matched.slice().sort((a, b) => {
      const da = distanceTo(a), db = distanceTo(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;      // remote roles sort last
      if (db === null) return -1;
      return da - db;
    });
  }

  return matched;
}

function applyFilters() {
  const visible = visibleJobs();
  const visibleIds = new Set(visible.map(j => j.id));

  $$(".job-marker").forEach(marker => {
    marker.classList.toggle("filtered-out", !visibleIds.has(marker.dataset.jobId));
  });

  renderMobileList(visible);

  const n = visible.length;
  const remote = visible.filter(j => j.lat === null).length;
  let text = n === JOBS.length ? `${n} jobs near campus`
           : n === 0           ? "No jobs match your search"
           :                     `${n} of ${JOBS.length} jobs`;
  if (n > 0 && remote > 0) text += ` · ${remote} remote`;
  els.resultCount.textContent = text;

  els.clearSearch.hidden = state.query === "";

  // If the open job just got filtered out, close the panel.
  if (state.currentJobId && !visibleIds.has(state.currentJobId)) closeDetails();
}

els.searchInput.addEventListener("input", event => {
  state.query = event.target.value;
  applyFilters();
});

els.searchInput.addEventListener("keydown", event => {
  if (event.key === "Escape" && state.query) {
    event.stopPropagation();
    clearSearchInput();
  }
});

function clearSearchInput() {
  state.query = "";
  els.searchInput.value = "";
  applyFilters();
}

els.clearSearch.addEventListener("click", () => {
  clearSearchInput();
  els.searchInput.focus();
});

els.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    state.filter = chip.dataset.filter;
    els.chips.forEach(c => {
      const on = c === chip;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    applyFilters();
  });
});

els.sortToggle.addEventListener("click", () => {
  state.sortByDistance = !state.sortByDistance;
  els.sortToggle.textContent = state.sortByDistance ? "Sorted by distance" : "Nearest first";
  applyFilters();
});

/* ------------------------------------------------------------
   MAP: RENDERING
   ------------------------------------------------------------ */

function renderMarkers() {
  els.markerLayer.replaceChildren();

  mappableJobs().forEach(job => {
    const { top, left } = project(job.lat, job.lng);

    const li = el("li");
    li.style.top = top + "%";
    li.style.left = left + "%";

    const button = el("button", "job-marker");
    button.type = "button";
    button.dataset.jobId = job.id;
    // Accessible name: the original pins announced as "•" or nothing.
    button.setAttribute("aria-label", `${job.title} at ${job.company}, ${job.location}`);
    button.setAttribute("aria-pressed", "false");
    button.appendChild(el("span", "pin-dot"));

    // A drag that happens to start on a pin must not open that pin.
    // `suppressNextClick` is set the moment a press becomes a drag and
    // cleared by the window-level listener below, which runs after this
    // handler because it's on the bubble phase.
    button.addEventListener("click", event => {
      if (suppressNextClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      selectJob(job.id);
    });

    li.appendChild(button);
    els.markerLayer.appendChild(li);
  });

  refreshMarkerStates();
}

function refreshMarkerStates() {
  $$(".job-marker").forEach(marker => {
    const id = marker.dataset.jobId;
    marker.classList.toggle("is-saved", isSaved(id));
    marker.setAttribute("aria-pressed", String(id === state.currentJobId));
  });
}

/* ------------------------------------------------------------
   MAP: PAN + ZOOM
   ------------------------------------------------------------ */

function clampPan() {
  // Allow roughly a quarter-viewport of travel at 1x, more as you zoom in.
  // The decorative layers extend past the canvas, so no empty edge shows.
  const rect = els.mapArea.getBoundingClientRect();
  const maxX = rect.width  * 0.25 * state.zoom;
  const maxY = rect.height * 0.25 * state.zoom;
  state.pan.x = Math.max(-maxX, Math.min(maxX, state.pan.x));
  state.pan.y = Math.max(-maxY, Math.min(maxY, state.pan.y));
}

function applyTransform() {
  els.mapCanvas.style.transform =
    `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
}

/** Animated transform change, for button-driven moves only. */
function animateTransform() {
  els.mapCanvas.classList.add("is-animating");
  applyTransform();
  clearTimeout(animateTransform.timer);
  animateTransform.timer = setTimeout(
    () => els.mapCanvas.classList.remove("is-animating"), 260);
}

function setZoom(next, animate = true) {
  state.zoom = Math.min(3, Math.max(1, Number(next.toFixed(3))));
  clampPan();
  animate ? animateTransform() : applyTransform();
}

function setPan(x, y, animate = false) {
  state.pan.x = x;
  state.pan.y = y;
  clampPan();
  animate ? animateTransform() : applyTransform();
}

/* ---- Pointer drag ---- */

const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false };

/* 6px, not 4. Below about 5px you're inside the range of unintentional
   mouse travel during an ordinary click, so pin taps would randomly fail
   to register — the other half of "finicky". */
const DRAG_THRESHOLD = 6;

/* Set when a press turns into a drag; consumed by the marker click
   handler. Kept separate from `drag.moved` because that flag has to
   reset when the drag ends, which is earlier than the click fires. */
let suppressNextClick = false;

// Bubble phase, so this runs after the marker's own click handler.
window.addEventListener("click", () => { suppressNextClick = false; });

els.mapArea.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;

  // Stops the browser's native text/image drag, which otherwise fights
  // with ours and leaves the map stuck mid-pan.
  event.preventDefault();

  drag.active = true;
  drag.moved = false;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.originX = state.pan.x;
  drag.originY = state.pan.y;

  els.mapArea.setPointerCapture(event.pointerId);
  els.mapCanvas.classList.remove("is-animating");
});

els.mapArea.addEventListener("pointermove", event => {
  if (!drag.active) return;

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;

  if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    drag.moved = true;
    suppressNextClick = true;
    els.mapArea.classList.add("is-dragging");
    hideMapHint();
  }
  if (!drag.moved) return;

  setPan(drag.originX + dx, drag.originY + dy);
});

function endDrag(event) {
  if (!drag.active) return;
  drag.active = false;
  els.mapArea.classList.remove("is-dragging");

  if (event && els.mapArea.hasPointerCapture?.(event.pointerId)) {
    els.mapArea.releasePointerCapture(event.pointerId);
  }

  drag.moved = false;

  /* Safety net: if the pointer is released outside any button, no click
     event follows and `suppressNextClick` would stay true, swallowing the
     user's next legitimate pin tap. Clear it once the click could have
     fired. */
  setTimeout(() => { suppressNextClick = false; }, 50);
}

els.mapArea.addEventListener("pointerup", endDrag);
els.mapArea.addEventListener("pointercancel", endDrag);

// Scroll to zoom, anchored to the cursor.
els.mapArea.addEventListener("wheel", event => {
  event.preventDefault();
  hideMapHint();

  const rect = els.mapArea.getBoundingClientRect();
  const prevZoom = state.zoom;
  const nextZoom = Math.min(3, Math.max(1, prevZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  if (nextZoom === prevZoom) return;

  // Keep the point under the cursor fixed while scaling.
  const cx = event.clientX - rect.left - rect.width / 2;
  const cy = event.clientY - rect.top - rect.height / 2;
  const ratio = nextZoom / prevZoom;

  state.zoom = nextZoom;
  state.pan.x = cx - (cx - state.pan.x) * ratio;
  state.pan.y = cy - (cy - state.pan.y) * ratio;
  clampPan();
  applyTransform();
}, { passive: false });

// Keyboard panning, so the map isn't mouse-only.
els.mapArea.setAttribute("tabindex", "0");
els.mapArea.setAttribute("role", "application");
els.mapArea.setAttribute("aria-label", "Job map. Use arrow keys to pan, plus and minus to zoom.");

els.mapArea.addEventListener("keydown", event => {
  const step = 60;
  const moves = {
    ArrowUp:    [0,  step], ArrowDown:  [0, -step],
    ArrowLeft:  [step, 0],  ArrowRight: [-step, 0]
  };

  if (event.key in moves) {
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    setPan(state.pan.x + dx, state.pan.y + dy, true);
    hideMapHint();
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setZoom(state.zoom + 0.25);
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    setZoom(state.zoom - 0.25);
  }
});

let hintTimer;
function hideMapHint() {
  els.mapHint.classList.add("is-hidden");
  clearTimeout(hintTimer);
}

$("#zoomIn").addEventListener("click",  () => setZoom(state.zoom + 0.35));
$("#zoomOut").addEventListener("click", () => setZoom(state.zoom - 0.35));

$("#resetMap").addEventListener("click", () => {
  state.zoom = 1;
  setPan(0, 0, true);
  state.filter = "all";
  els.chips.forEach(c => {
    const on = c.dataset.filter === "all";
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", String(on));
  });
  clearSearchInput();
  closeDetails();
  showToast("Map reset");
});

/* ------------------------------------------------------------
   GEOLOCATION

   Notes on why this is shaped the way it is:
   - Only ever fired from a click. Browsers increasingly refuse
     permission prompts without a user gesture, and asking on page
     load is a good way to get permanently denied.
   - Requires a secure context (https:// or localhost). Opening the
     file directly with file:// will not work in Chrome; we detect
     that and say so rather than failing silently.
   - The map is stylized, not tiled, so the user dot is only
     meaningful inside MAP_BOUNDS. Outside it we skip the dot but
     still show real distances, which stay correct anywhere.
   ------------------------------------------------------------ */

function locateUser() {
  if (!("geolocation" in navigator)) {
    showToast("Your browser doesn't support location.");
    return;
  }

  if (!window.isSecureContext) {
    showToast("Location needs https:// — it won't work opening the file directly.");
    return;
  }

  els.locateBtn.classList.add("is-busy");
  els.locateBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  });
}

function onLocationSuccess(position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  state.userLocation = { lat, lng, accuracy };

  els.locateBtn.classList.remove("is-busy");
  els.locateBtn.classList.add("is-active");
  els.locateBtn.disabled = false;

  // Offer distance sorting now that it means something.
  els.sortToggle.hidden = false;

  if (withinBounds(lat, lng)) {
    const { top, left } = project(lat, lng);
    els.userMarker.style.top = top + "%";
    els.userMarker.style.left = left + "%";
    els.userMarker.hidden = false;

    // Recenter the map on the user.
    const rect = els.mapArea.getBoundingClientRect();
    setPan(
      -((left - 50) / 100) * rect.width  * state.zoom,
      -((top  - 50) / 100) * rect.height * state.zoom,
      true
    );
    showToast("Showing your location");
  } else {
    els.userMarker.hidden = true;
    const nearest = mappableJobs()
      .map(j => haversineMiles({ lat, lng }, { lat: j.lat, lng: j.lng }))
      .sort((a, b) => a - b)[0];
    showToast(`You're outside the map area — nearest job is ${formatDistance(nearest)}.`);
  }

  // Distances are now known, so re-render anything that displays them.
  applyFilters();
  renderSavedJobs();
  if (state.currentJobId) renderJobDetails(jobById(state.currentJobId));
}

function onLocationError(error) {
  els.locateBtn.classList.remove("is-busy");
  els.locateBtn.disabled = false;

  const messages = {
    1: "Location permission denied. You can re-enable it in your browser's site settings.",
    2: "Couldn't determine your location. Check that location services are on.",
    3: "Location request timed out. Try again."
  };
  showToast(messages[error.code] || "Couldn't get your location.");
}

els.locateBtn.addEventListener("click", locateUser);

/* ------------------------------------------------------------
   JOB DETAILS
   ------------------------------------------------------------ */

function selectJob(id) {
  const job = jobById(id);
  if (!job) return;

  state.currentJobId = id;
  renderJobDetails(job);
  refreshMarkerStates();

  els.detailsBox.classList.add("is-open");
  els.detailsBox.classList.remove("show-hint");
  els.closeDetails.hidden = false;

  $$(".list-card").forEach(card => {
    card.classList.toggle("is-active", card.dataset.jobId === id);
  });
}

function closeDetails() {
  state.currentJobId = null;
  els.detailsBox.classList.remove("is-open");
  els.detailsBox.classList.add("show-hint");
  els.closeDetails.hidden = true;
  els.detailsContent.replaceChildren(
    el("p", "muted empty-hint", "Select a pin on the map to see job details.")
  );
  updateSaveButton();
  refreshMarkerStates();
  $$(".list-card").forEach(card => card.classList.remove("is-active"));
}

function renderJobDetails(job) {
  const deadline = deadlineLabel(job.closes);
  const miles = distanceTo(job);

  const frag = document.createDocumentFragment();
  frag.append(
    el("div", "job-title", job.title),
    el("div", "job-company", job.company),
    el("div", "job-meta", `${job.type} · ${job.location} · ${job.pay}`)
  );

  if (miles !== null) frag.appendChild(el("span", "job-distance", formatDistance(miles)));

  const tags = el("div", "tag-row");
  job.tags.forEach(t => tags.appendChild(el("span", "tag", t)));
  frag.append(tags, el("p", "job-desc", job.description));

  const dl = el("div", "job-deadline" + (deadline.urgent ? " urgent" : ""));
  dl.textContent = deadline.text + (job.resumeRequired ? " · Resume required" : "");
  frag.appendChild(dl);

  els.detailsContent.replaceChildren(frag);
  updateSaveButton();
}

function updateSaveButton() {
  const btn = els.saveJobButton;

  if (!state.currentJobId) {
    btn.disabled = true;
    btn.textContent = "Save job";
    btn.classList.remove("is-saved");
    return;
  }

  const saved = isSaved(state.currentJobId);
  btn.disabled = false;
  btn.textContent = saved ? "✓ Saved" : "Save job";
  btn.classList.toggle("is-saved", saved);
  // The original could never un-save from the map. This toggles.
  btn.setAttribute("aria-pressed", String(saved));
}

els.closeDetails.addEventListener("click", closeDetails);

els.saveJobButton.addEventListener("click", () => {
  const id = state.currentJobId;
  if (!id) return;

  const job = jobById(id);
  if (isSaved(id)) {
    state.savedIds = state.savedIds.filter(x => x !== id);
    showToast(`Removed ${job.title}`);
  } else {
    state.savedIds.push(id);
    showToast(`Saved ${job.title}`);
  }

  persistSaved();
  updateSaveButton();
  refreshMarkerStates();
  renderSavedJobs();
  renderMobileList(visibleJobs());
});

function persistSaved() {
  if (!storage.set(STORAGE_KEYS.saved, state.savedIds)) {
    showToast("Saved for this session only — storage is unavailable.");
  }
}

/* ------------------------------------------------------------
   MOBILE LIST
   ------------------------------------------------------------ */

function renderMobileList(jobs) {
  els.mobileList.replaceChildren();

  if (jobs.length === 0) {
    const empty = el("div", "empty-state");
    empty.append(
      el("h2", null, "No matches"),
      el("p", null, "Try a different search term or clear your filters.")
    );
    els.mobileList.appendChild(empty);
    return;
  }

  jobs.forEach(job => {
    const deadline = deadlineLabel(job.closes);
    const miles = distanceTo(job);

    const card = el("button", "list-card");
    card.type = "button";
    card.dataset.jobId = job.id;
    if (job.id === state.currentJobId) card.classList.add("is-active");

    card.append(
      el("div", "lc-title", job.title),
      el("div", "lc-meta", `${job.company} · ${job.location}`),
      el("div", "lc-meta", `${job.type} · ${job.pay}`)
    );

    const foot = el("div", "lc-foot");
    const dl = el("span", deadline.urgent ? "" : "muted", deadline.text);
    if (deadline.urgent) dl.style.color = "var(--danger)";
    foot.appendChild(dl);

    const right = el("span");
    if (miles !== null) right.appendChild(el("span", "job-distance", formatDistance(miles)));
    if (isSaved(job.id)) right.appendChild(el("span", "tag", "Saved"));
    foot.appendChild(right);

    card.appendChild(foot);
    card.addEventListener("click", () => selectJob(job.id));
    els.mobileList.appendChild(card);
  });
}

/* ------------------------------------------------------------
   SAVED VIEW
   ------------------------------------------------------------ */

function renderSavedJobs() {
  const count = state.savedIds.length;

  els.savedCount.textContent = `${count} job${count === 1 ? "" : "s"}`;
  els.navBadge.textContent = String(count);
  els.navBadge.hidden = count === 0;

  els.savedContainer.replaceChildren();

  if (count === 0) {
    const empty = el("div", "empty-state");
    const cta = el("button", "primary-button", "Browse jobs");
    cta.type = "button";
    cta.addEventListener("click", () => {
      switchView("homeView");
      els.navLinks[0].focus();
    });
    empty.append(
      el("h2", null, "Nothing saved yet"),
      el("p", null, "Tap a pin on the map and save the roles you want to come back to."),
      cta
    );
    els.savedContainer.appendChild(empty);
    return;
  }

  // Soonest deadline first — the ordering a user actually needs.
  const sorted = state.savedIds
    .map(jobById)
    .filter(Boolean)
    .sort((a, b) => new Date(a.closes) - new Date(b.closes));

  sorted.forEach(job => {
    const deadline = deadlineLabel(job.closes);
    const miles = distanceTo(job);

    const wrapper = el("div", "saved-job");
    const header = el("div", "saved-job-header");

    const meta = el("div", "saved-job-meta");
    meta.append(
      el("div", "saved-job-type", job.type),
      el("div", "saved-job-title", job.title),
      el("div", "saved-job-company", `${job.company} · ${job.location}`)
    );

    const actions = el("div", "saved-job-actions");

    const removeBtn = el("button", "delete-button", "×");
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${job.title} from saved jobs`);
    removeBtn.addEventListener("click", () => removeSaved(job.id));

    const applyBtn = el("button", "secondary-button", "Apply");
    applyBtn.type = "button";
    applyBtn.addEventListener("click", () => {
      showToast("Applications aren't wired up in this prototype.");
    });

    actions.append(removeBtn, applyBtn);
    header.append(meta, actions);

    const foot = el("div", "saved-job-foot");
    const dl = el("strong", null, deadline.text);
    if (deadline.urgent) dl.style.color = "var(--danger)";
    foot.append(dl, el("span", "muted", job.resumeRequired ? "Resume required" : "No resume needed"));
    if (miles !== null) foot.appendChild(el("span", "muted", formatDistance(miles)));

    wrapper.append(header, foot);
    els.savedContainer.appendChild(wrapper);
  });
}

function removeSaved(id) {
  const job = jobById(id);
  state.savedIds = state.savedIds.filter(x => x !== id);
  persistSaved();
  renderSavedJobs();
  refreshMarkerStates();
  renderMobileList(visibleJobs());
  if (state.currentJobId === id) updateSaveButton();
  showToast(`Removed ${job ? job.title : "job"}`);
}

/* ------------------------------------------------------------
   NOTIFICATIONS MODAL
   ------------------------------------------------------------ */

let lastFocused = null;

function openNotif() {
  lastFocused = document.activeElement;
  els.notifPanel.hidden = false;
  els.closeNotif.focus();
}

function closeNotif() {
  els.notifPanel.hidden = true;
  if (lastFocused) lastFocused.focus();
}

els.notifButton.addEventListener("click", openNotif);
els.closeNotif.addEventListener("click", closeNotif);

els.notifPanel.addEventListener("click", event => {
  if (event.target === els.notifPanel) closeNotif();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!els.notifPanel.hidden) { closeNotif(); return; }
  if (state.currentJobId) closeDetails();
});

/* ------------------------------------------------------------
   PROFILE
   ------------------------------------------------------------ */

const profileFields = ["name", "major", "grad", "bio", "url"];

function loadProfile() {
  const saved = storage.get(STORAGE_KEYS.profile, null);
  if (!saved) return;

  profileFields.forEach(key => {
    const input = els.profileForm.elements[key];
    if (input && typeof saved[key] === "string") input.value = saved[key];
  });
  updateBioCount();
}

function updateBioCount() {
  els.bioCount.textContent = String(els.profileForm.elements.bio.value.length);
}

els.profileForm.elements.bio.addEventListener("input", updateBioCount);

els.profileForm.addEventListener("submit", event => {
  event.preventDefault();

  const urlInput = els.profileForm.elements.url;
  const urlError = $("#pfUrlError");
  const urlField = urlInput.closest(".field");
  const value = urlInput.value.trim();

  if (value && !/^https?:\/\/.+\..+/i.test(value)) {
    urlError.hidden = false;
    urlField.classList.add("has-error");
    urlInput.setAttribute("aria-invalid", "true");
    urlInput.focus();
    return;
  }

  urlError.hidden = true;
  urlField.classList.remove("has-error");
  urlInput.removeAttribute("aria-invalid");

  const data = {};
  profileFields.forEach(key => { data[key] = els.profileForm.elements[key].value.trim(); });

  const ok = storage.set(STORAGE_KEYS.profile, data);
  els.profileStatus.textContent = ok ? "Saved" : "Couldn't save — storage unavailable";
  els.profileStatus.style.color = ok ? "var(--success)" : "var(--danger)";
  setTimeout(() => { els.profileStatus.textContent = ""; }, 3000);
});

// Resume: validate size and type, but don't pretend to upload.
$("#pfResume").addEventListener("change", event => {
  const file = event.target.files[0];
  const error = $("#pfResumeError");
  if (!file) { error.hidden = true; return; }

  if (file.size > 5 * 1024 * 1024) {
    error.textContent = "That file is over 5 MB. Please choose a smaller one.";
    error.hidden = false;
    event.target.value = "";
    return;
  }

  error.hidden = true;
  showToast(`${file.name} attached (not uploaded in this prototype)`);
});

/* ------------------------------------------------------------
   INIT
   ------------------------------------------------------------ */

const VERSION = "2.2";

function init() {
  // Version stamp so you can confirm in DevTools which build is running.
  console.log(
    `%cPathfinder v${VERSION}%c  drag-to-pan · geolocation · toast fix`,
    "background:#3f6fd8;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
    "color:#5c6470"
  );

  els.chips.forEach(c => c.setAttribute("aria-pressed", String(c.classList.contains("active"))));

  renderMarkers();
  applyFilters();
  renderSavedJobs();
  loadProfile();
  updateSaveButton();
  applyTransform();

  els.detailsBox.classList.add("show-hint");

  // Fade the pan/zoom hint once it's had time to be read.
  hintTimer = setTimeout(hideMapHint, 6000);
}

init();
