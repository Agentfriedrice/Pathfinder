/* ============================================================
   Pathfinder
   Vanilla JS, no build step, no dependencies.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   DATA
   Sample listings. Coordinates are percentages on the map canvas.
   `posted` and `closes` are ISO dates so deadline math stays real
   instead of a hardcoded "Apply by M/D/YY".
   ------------------------------------------------------------ */

const JOBS = [
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
    top: 78, left: 68
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
    top: 24, left: 60
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
    top: 52, left: 34
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
    top: 40, left: 82
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
    top: 70, left: 26
  },
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
    top: 86, left: 50
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
    top: 16, left: 40
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
    top: 60, left: 88
  }
];

const STORAGE_KEYS = {
  saved: "pathfinder.savedJobs.v1",
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
  zoom: 1
};

const jobById = id => JOBS.find(j => j.id === id);

/* ------------------------------------------------------------
   DOM REFS
   ------------------------------------------------------------ */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const els = {
  navLinks:      $$(".nav-link"),
  views:         $$(".view"),
  navBadge:      $("#navSavedBadge"),

  searchInput:   $("#searchInput"),
  clearSearch:   $("#clearSearch"),
  chips:         $$(".chip"),
  resultCount:   $("#resultCount"),

  mapCanvas:     $("#mapCanvas"),
  markerLayer:   $("#markerLayer"),
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
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

function deadlineLabel(isoDate) {
  const days = daysUntil(isoDate);
  const pretty = new Date(isoDate + "T00:00:00")
    .toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (days < 0)  return { text: "Closed",                     urgent: false, closed: true };
  if (days === 0) return { text: "Closes today",              urgent: true,  closed: false };
  if (days === 1) return { text: "Closes tomorrow",           urgent: true,  closed: false };
  if (days <= 7)  return { text: `Closes in ${days} days`,    urgent: true,  closed: false };
  return { text: `Apply by ${pretty}`, urgent: false, closed: false };
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add("is-visible"));
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function isSaved(id) { return state.savedIds.includes(id); }

/* ------------------------------------------------------------
   NAVIGATION
   ------------------------------------------------------------ */

function switchView(targetId) {
  els.navLinks.forEach(link => {
    const on = link.dataset.target === targetId;
    link.classList.toggle("active", on);
    link.setAttribute("aria-selected", String(on));
  });

  els.views.forEach(view => {
    view.classList.toggle("active-view", view.id === targetId);
  });

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
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
    if (!(event.key in keys)) return;
    event.preventDefault();

    let next;
    if (keys[event.key] === "first")      next = 0;
    else if (keys[event.key] === "last")  next = els.navLinks.length - 1;
    else next = (index + keys[event.key] + els.navLinks.length) % els.navLinks.length;

    els.navLinks[next].focus();
    switchView(els.navLinks[next].dataset.target);
  });
});

/* ------------------------------------------------------------
   FILTERING
   ------------------------------------------------------------ */

function visibleJobs() {
  const q = state.query.trim().toLowerCase();

  return JOBS.filter(job => {
    if (state.filter !== "all" && job.type !== state.filter) return false;
    if (!q) return true;

    const haystack = [job.title, job.company, job.location, job.type, ...job.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function applyFilters() {
  const visible = visibleJobs();
  const visibleIds = new Set(visible.map(j => j.id));

  $$(".job-marker").forEach(marker => {
    marker.classList.toggle("filtered-out", !visibleIds.has(marker.dataset.jobId));
  });

  renderMobileList(visible);

  const n = visible.length;
  els.resultCount.textContent =
    n === JOBS.length ? `${n} jobs near campus`
    : n === 0         ? "No jobs match your search"
    :                   `${n} of ${JOBS.length} jobs`;

  els.clearSearch.hidden = state.query === "";

  // If the open job just got filtered out, close the panel to avoid
  // showing detail for something no longer on screen.
  if (state.currentJobId && !visibleIds.has(state.currentJobId)) {
    closeDetails();
  }
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
  els.searchInput.focus();
}

els.clearSearch.addEventListener("click", clearSearchInput);

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

/* ------------------------------------------------------------
   MAP
   ------------------------------------------------------------ */

function renderMarkers() {
  els.markerLayer.replaceChildren();

  JOBS.forEach(job => {
    const li = el("li");
    li.style.top = job.top + "%";
    li.style.left = job.left + "%";

    const button = el("button", "job-marker");
    button.type = "button";
    button.dataset.jobId = job.id;
    // Accessible name: the original pins announced as "•" or nothing.
    button.setAttribute("aria-label", `${job.title} at ${job.company}, ${job.location}`);
    button.setAttribute("aria-pressed", "false");
    button.appendChild(el("span", "pin-dot"));

    button.addEventListener("click", () => selectJob(job.id));

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

function setZoom(next) {
  state.zoom = Math.min(2.2, Math.max(1, next));
  els.mapCanvas.style.transform = `scale(${state.zoom})`;
}

$("#zoomIn").addEventListener("click",  () => setZoom(state.zoom + 0.25));
$("#zoomOut").addEventListener("click", () => setZoom(state.zoom - 0.25));
$("#resetMap").addEventListener("click", () => {
  setZoom(1);
  state.filter = "all";
  els.chips.forEach(c => c.classList.toggle("active", c.dataset.filter === "all"));
  clearSearchInput();
  closeDetails();
  showToast("Map reset");
});

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

  const frag = document.createDocumentFragment();
  frag.append(
    el("div", "job-title", job.title),
    el("div", "job-company", job.company),
    el("div", "job-meta", `${job.type} · ${job.location} · ${job.pay}`)
  );

  const tags = el("div", "tag-row");
  job.tags.forEach(t => tags.appendChild(el("span", "tag", t)));
  frag.appendChild(tags);

  frag.appendChild(el("p", "job-desc", job.description));

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
  const ok = storage.set(STORAGE_KEYS.saved, state.savedIds);
  if (!ok) showToast("Saved for this session only — storage is unavailable.");
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
    const dl = el("span", "muted", deadline.text);
    if (deadline.urgent) dl.className = "";
    foot.append(dl);
    if (isSaved(job.id)) foot.append(el("span", "tag", "Saved"));
    card.appendChild(foot);

    card.addEventListener("click", () => selectJob(job.id));
    els.mobileList.appendChild(card);
  });
}

/* ------------------------------------------------------------
   SAVED VIEW
   ------------------------------------------------------------ */

function renderSavedJobs() {
  const ids = state.savedIds;
  const count = ids.length;

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
  const sorted = ids
    .map(jobById)
    .filter(Boolean)
    .sort((a, b) => new Date(a.closes) - new Date(b.closes));

  sorted.forEach(job => {
    const deadline = deadlineLabel(job.closes);

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

  let valid = true;
  if (value && !/^https?:\/\/.+\..+/i.test(value)) {
    valid = false;
    urlError.hidden = false;
    urlField.classList.add("has-error");
    urlInput.setAttribute("aria-invalid", "true");
    urlInput.focus();
  } else {
    urlError.hidden = true;
    urlField.classList.remove("has-error");
    urlInput.removeAttribute("aria-invalid");
  }

  if (!valid) return;

  const data = {};
  profileFields.forEach(key => {
    data[key] = els.profileForm.elements[key].value.trim();
  });

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

  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) {
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

function init() {
  els.chips.forEach(c => c.setAttribute("aria-pressed", String(c.classList.contains("active"))));

  renderMarkers();
  applyFilters();
  renderSavedJobs();
  loadProfile();
  updateSaveButton();

  els.detailsBox.classList.add("show-hint");
}

init();
