/* =========================================================
   Ironclad & Chrome — Restoration Shop Portfolio
   Vanilla JS. No frameworks, no external libs.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     TELEMETRY (simulated analytics)
     --------------------------------------------------------- */
  function logAnalytics(action, detail) {
    // eslint-disable-next-line no-console
    console.log(
      "[Analytics] User interacted with Classic Car Restoration Shop Portfolio",
      { action: action, detail: detail || null, at: new Date().toISOString() }
    );
  }

  /* ---------------------------------------------------------
     SECURITY — sanitize all free-text input before it ever
     touches state or the DOM. Escapes HTML-significant chars
     so stored values cannot execute as markup/script.
     --------------------------------------------------------- */
  function sanitizeText(raw) {
    if (typeof raw !== "string") return "";
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .trim();
  }

  /* ---------------------------------------------------------
     STATE — in-memory "database" for this session.
     Seeded with a few realistic work orders.
     --------------------------------------------------------- */
  var STATUS_LABELS = {
    intake: "Intake",
    teardown: "Teardown",
    bodywork: "Bodywork",
    paint: "Paint",
    mechanical: "Mechanical",
    reassembly: "Reassembly",
    ready: "Ready for Delivery"
  };

  var state = {
    projects: [
      { id: "p1", client: "R. Alvarez", make: "Chevrolet", model: "Bel Air", year: 1957, vin: "VC57B123456", status: "bodywork", notes: "Full quarter panel replacement, original trim salvageable." },
      { id: "p2", client: "M. Okafor", make: "Ford", model: "Mustang", year: 1966, vin: "6F07C112233", status: "paint", notes: "Client wants factory Wimbledon White, single-stage." },
      { id: "p3", client: "T. Nakamura", make: "Jaguar", model: "E-Type", year: 1962, vin: "", status: "mechanical", notes: "Rebuilding the XK engine, sourcing SU carbs." },
      { id: "p4", client: "S. Kowalski", make: "Volkswagen", model: "Karmann Ghia", year: 1970, vin: "1102345678", status: "intake", notes: "Just arrived on the flatbed, full assessment pending." },
      { id: "p5", client: "D. Patel", make: "Porsche", model: "356", year: 1959, vin: "", status: "ready", notes: "Final detail complete, awaiting client pickup Friday." }
    ],
    filterText: "",
    filterStatus: "all",
    boardLoaded: false,
    boardError: false
  };

  var nextIdCounter = state.projects.length + 1;

  /* ---------------------------------------------------------
     SIMULATED NETWORK — mimics a spotty 3G connection.
     Randomly fails ~15% of the time so the retry / error
     path actually gets exercised, not just the happy path.
     --------------------------------------------------------- */
  function simulateNetworkFetch(payload, opts) {
    opts = opts || {};
    var delay = opts.delay || (500 + Math.random() * 900);
    var failRate = typeof opts.failRate === "number" ? opts.failRate : 0.15;
    return new Promise(function (resolve, reject) {
      window.setTimeout(function () {
        if (Math.random() < failRate) {
          reject(new Error("Network request failed — connection dropped."));
        } else {
          resolve(payload);
        }
      }, delay);
    });
  }

  /* ---------------------------------------------------------
     DOM REFERENCES
     --------------------------------------------------------- */
  var boardEl = document.getElementById("board");
  var boardStatusEl = document.getElementById("boardStatus");
  var retryBtn = document.getElementById("retryLoad");
  var gaugeRow = document.getElementById("gaugeRow");
  var searchInput = document.getElementById("searchInput");
  var statusFilter = document.getElementById("statusFilter");
  var resetFiltersBtn = document.getElementById("resetFilters");
  var intakeForm = document.getElementById("intakeForm");
  var submitBtn = document.getElementById("submitIntake");
  var formStatus = document.getElementById("formStatus");
  var toastEl = document.getElementById("toast");
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");

  /* ---------------------------------------------------------
     MOBILE NAV TOGGLE (keyboard accessible)
     --------------------------------------------------------- */
  navToggle.addEventListener("click", function () {
    var isOpen = primaryNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  /* ---------------------------------------------------------
     TOAST — brief, non-blocking confirmation messages
     --------------------------------------------------------- */
  var toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.hidden = true;
    }, 3200);
  }

  /* ---------------------------------------------------------
     GAUGES — analog speedometer SVG builder
     Draws a semicircular track, a copper progress arc, five
     tick marks, and a needle that points to the current
     percentage — like a real dashboard, not a progress bar.
     --------------------------------------------------------- */
  function polar(cx, cy, r, angleDeg) {
    var rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function buildGaugeSVG(pct) {
    var clamped = Math.max(0, Math.min(100, pct));
    var cx = 60, cy = 58, r = 46;
    var startAngle = 180, endAngle = 0;
    var sweepAngle = startAngle - (clamped / 100) * (startAngle - endAngle);

    var start = polar(cx, cy, r, startAngle);
    var full = polar(cx, cy, r, endAngle);
    var progressEnd = polar(cx, cy, r, sweepAngle);
    var largeArc = (startAngle - sweepAngle) > 180 ? 1 : 0;

    var trackPath = "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 1 1 " + full.x + " " + full.y;
    var progressPath = clamped > 0.5
      ? "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 " + largeArc + " 1 " + progressEnd.x + " " + progressEnd.y
      : "";

    var ticks = [0, 25, 50, 75, 100].map(function (t) {
      var a = startAngle - (t / 100) * (startAngle - endAngle);
      var inner = polar(cx, cy, r - 9, a);
      var outer = polar(cx, cy, r - 1, a);
      return '<line class="gauge-tick" x1="' + inner.x + '" y1="' + inner.y + '" x2="' + outer.x + '" y2="' + outer.y + '"/>';
    }).join("");

    var needleTip = polar(cx, cy, r - 14, sweepAngle);

    return (
      '<svg class="gauge-analog" viewBox="0 0 120 64" role="presentation" aria-hidden="true">' +
        '<path class="gauge-track" d="' + trackPath + '"/>' +
        (progressPath ? '<path class="gauge-progress" d="' + progressPath + '"/>' : '') +
        ticks +
        '<line class="gauge-needle" x1="' + cx + '" y1="' + cy + '" x2="' + needleTip.x + '" y2="' + needleTip.y + '"/>' +
        '<circle class="gauge-hub" cx="' + cx + '" cy="' + cy + '" r="4"/>' +
      '</svg>'
    );
  }

  /* ---------------------------------------------------------
     GAUGES — dashboard summary
     --------------------------------------------------------- */
  function renderGauges() {
    var total = state.projects.length;
    var readyCount = state.projects.filter(function (p) { return p.status === "ready"; }).length;
    var inProgress = total - readyCount;
    var pctReady = total ? Math.round((readyCount / total) * 100) : 0;

    var statusCounts = {};
    state.projects.forEach(function (p) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    var busiestStatus = Object.keys(statusCounts).sort(function (a, b) {
      return statusCounts[b] - statusCounts[a];
    })[0];
    var busiestPct = total ? Math.round((statusCounts[busiestStatus] || 0) / total * 100) : 0;

    var gauges = [
      { label: "On the Board", value: total, pct: 100, detail: total === 1 ? "1 vehicle tracked" : total + " vehicles tracked" },
      { label: "In Progress", value: inProgress, pct: total ? Math.round((inProgress / total) * 100) : 0, detail: "Not yet ready for delivery" },
      { label: "Ready for Delivery", value: readyCount, pct: pctReady, detail: pctReady + "% of the board" },
      { label: "Busiest Stage", value: busiestStatus ? STATUS_LABELS[busiestStatus] : "—", pct: busiestPct, detail: busiestStatus ? busiestPct + "% of vehicles" : "No data yet" }
    ];

    gaugeRow.innerHTML = gauges.map(function (g) {
      var srLabel = sanitizeText(String(g.label)) + ": " + sanitizeText(String(g.value)) + ", " + sanitizeText(String(g.detail));
      return (
        '<div class="gauge-card" role="img" aria-label="' + srLabel + '">' +
          buildGaugeSVG(g.pct) +
          '<p class="gauge-readout">' + sanitizeText(String(g.value)) +
            (typeof g.value === "number" ? '<span class="gauge-readout-unit">' + (g.label === "Ready for Delivery" ? "cars" : "") + '</span>' : '') +
          '</p>' +
          '<p class="gauge-label">' + sanitizeText(g.label) + '</p>' +
          '<p class="gauge-detail">' + sanitizeText(g.detail) + '</p>' +
        '</div>'
      );
    }).join("");
  }

  /* ---------------------------------------------------------
     BOARD RENDERING — loading / error / empty / data states
     --------------------------------------------------------- */
  function renderSkeleton() {
    boardEl.setAttribute("aria-busy", "true");
    boardStatusEl.textContent = "Loading restorations…";
    var cards = "";
    for (var i = 0; i < 4; i++) {
      cards +=
        '<div class="skeleton-card" aria-hidden="true">' +
          '<div class="skeleton-line" style="width:70%"></div>' +
          '<div class="skeleton-line short"></div>' +
          '<div class="skeleton-line" style="width:90%"></div>' +
        '</div>';
    }
    boardEl.innerHTML = cards;
    retryBtn.hidden = true;
  }

  function renderError() {
    boardEl.setAttribute("aria-busy", "false");
    boardStatusEl.textContent = "The board couldn't load.";
    boardEl.innerHTML =
      '<div class="error-state">' +
        '<h3>Connection dropped</h3>' +
        '<p>We couldn\u2019t reach the board on this connection. Your data is safe — nothing was lost.</p>' +
      '</div>';
    retryBtn.hidden = false;
  }

  function getFilteredProjects() {
    var text = state.filterText.trim().toLowerCase();
    return state.projects.filter(function (p) {
      var matchesStatus = state.filterStatus === "all" || p.status === state.filterStatus;
      if (!matchesStatus) return false;
      if (!text) return true;
      var haystack = [p.client, p.make, p.model, p.vin, String(p.year)].join(" ").toLowerCase();
      return haystack.indexOf(text) !== -1;
    });
  }

  function renderBoard() {
    boardEl.setAttribute("aria-busy", "false");
    retryBtn.hidden = true;

    if (state.projects.length === 0) {
      boardStatusEl.textContent = "No vehicles on the board yet.";
      boardEl.innerHTML =
        '<div class="empty-state">' +
          '<h3>No data found</h3>' +
          '<p>Nothing has been logged yet. Use \u201cLog New Intake\u201d below to add the first vehicle.</p>' +
        '</div>';
      return;
    }

    var filtered = getFilteredProjects();

    if (filtered.length === 0) {
      boardStatusEl.textContent = "0 results for the current search and filter.";
      boardEl.innerHTML =
        '<div class="empty-state">' +
          '<h3>No data found</h3>' +
          '<p>No restorations match this search or status filter. Try clearing the filters.</p>' +
        '</div>';
      return;
    }

    boardStatusEl.textContent = filtered.length + " of " + state.projects.length + " restorations shown.";

    boardEl.innerHTML = filtered.map(function (p) {
      var vinLine = p.vin ? "VIN " + sanitizeText(p.vin) : "VIN not yet recorded";
      return (
        '<article class="card" data-status="' + p.status + '" aria-label="' + sanitizeText(p.year + " " + p.make + " " + p.model) + '">' +
          '<h3 class="card-title">' + sanitizeText(String(p.year)) + " " + sanitizeText(p.make) + " " + sanitizeText(p.model) + '</h3>' +
          '<p class="card-client">Client: ' + sanitizeText(p.client) + '</p>' +
          '<p class="card-meta">' + vinLine + '</p>' +
          (p.notes ? '<p class="card-notes">' + sanitizeText(p.notes) + '</p>' : '') +
          '<div class="card-footer">' +
            '<span class="status-pill">' + sanitizeText(STATUS_LABELS[p.status] || p.status) + '</span>' +
            '<button type="button" class="btn btn-ghost btn-small" data-remove="' + p.id + '" aria-label="Remove ' + sanitizeText(p.year + " " + p.make + " " + p.model) + ' from board">Remove</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");

    // wire up per-card remove buttons
    Array.prototype.forEach.call(boardEl.querySelectorAll("[data-remove]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-remove");
        state.projects = state.projects.filter(function (p) { return p.id !== id; });
        logAnalytics("remove_project", { id: id });
        showToast("Removed from board.");
        renderBoard();
        renderGauges();
      });
    });
  }

  function loadBoard(isRetry) {
    state.boardError = false;
    renderSkeleton();
    simulateNetworkFetch(state.projects)
      .then(function () {
        state.boardLoaded = true;
        renderBoard();
        renderGauges();
        if (isRetry) showToast("Board reconnected.");
      })
      .catch(function () {
        state.boardError = true;
        renderError();
      });
  }

  retryBtn.addEventListener("click", function () {
    logAnalytics("retry_board_load");
    loadBoard(true);
  });

  /* ---------------------------------------------------------
     FILTERS
     --------------------------------------------------------- */
  var searchDebounce = null;
  searchInput.addEventListener("input", function () {
    window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(function () {
      state.filterText = searchInput.value;
      renderBoard();
      logAnalytics("search_projects", { query: sanitizeText(searchInput.value) });
    }, 200);
  });

  statusFilter.addEventListener("change", function () {
    state.filterStatus = statusFilter.value;
    renderBoard();
    logAnalytics("filter_projects", { status: state.filterStatus });
  });

  resetFiltersBtn.addEventListener("click", function () {
    searchInput.value = "";
    statusFilter.value = "all";
    state.filterText = "";
    state.filterStatus = "all";
    renderBoard();
    logAnalytics("clear_filters");
  });

  /* ---------------------------------------------------------
     INTAKE FORM — validation, sanitization, submission
     --------------------------------------------------------- */
  var fieldConfig = [
    { id: "clientName", errId: "err-clientName", validate: function (v) {
        if (!v.trim()) return "Enter the client's name.";
        return "";
      } },
    { id: "clientPhone", errId: "err-clientPhone", validate: function (v) {
        if (!v.trim()) return "Enter a phone number.";
        var digits = v.replace(/\D/g, "");
        if (digits.length < 7) return "Enter a valid phone number.";
        return "";
      } },
    { id: "carMake", errId: "err-carMake", validate: function (v) {
        if (!v.trim()) return "Enter the vehicle make.";
        return "";
      } },
    { id: "carModel", errId: "err-carModel", validate: function (v) {
        if (!v.trim()) return "Enter the vehicle model.";
        return "";
      } },
    { id: "carYear", errId: "err-carYear", validate: function (v) {
        if (!v.trim()) return "Enter the model year.";
        var year = Number(v);
        if (!Number.isInteger(year) || year < 1900 || year > 2026) {
          return "Enter a year between 1900 and 2026.";
        }
        return "";
      } },
    { id: "vin", errId: "err-vin", validate: function (v) {
        if (!v.trim()) return ""; // optional
        if (v.trim().length < 5 || v.trim().length > 17) return "VIN should be 5–17 characters, or left blank.";
        return "";
      } },
    { id: "statusSelect", errId: "err-statusSelect", validate: function (v) {
        if (!v) return "Choose a starting status.";
        return "";
      } },
    { id: "notes", errId: "err-notes", validate: function () { return ""; } }
  ];

  function setFieldError(fieldId, errId, message) {
    var input = document.getElementById(fieldId);
    var errEl = document.getElementById(errId);
    var wrapper = input.closest(".field");
    if (message) {
      wrapper.classList.add("has-error");
      input.setAttribute("aria-invalid", "true");
      errEl.textContent = message;
    } else {
      wrapper.classList.remove("has-error");
      input.removeAttribute("aria-invalid");
      errEl.textContent = "";
    }
  }

  function validateForm() {
    var firstInvalidEl = null;
    var isValid = true;
    fieldConfig.forEach(function (cfg) {
      var input = document.getElementById(cfg.id);
      var message = cfg.validate(input.value);
      setFieldError(cfg.id, cfg.errId, message);
      if (message) {
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = input;
      }
    });
    if (firstInvalidEl) firstInvalidEl.focus();
    return isValid;
  }

  // live-clear errors as the user fixes them
  fieldConfig.forEach(function (cfg) {
    var input = document.getElementById(cfg.id);
    input.addEventListener("input", function () {
      var message = cfg.validate(input.value);
      if (!message) setFieldError(cfg.id, cfg.errId, "");
    });
    input.addEventListener("blur", function () {
      input.setAttribute("data-touched", "true");
    });
  });

  intakeForm.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validateForm()) {
      formStatus.textContent = "Fix the highlighted fields before adding this vehicle.";
      formStatus.setAttribute("data-state", "error");
      logAnalytics("intake_validation_failed");
      return;
    }

    var payload = {
      id: "p" + (nextIdCounter++),
      client: sanitizeText(document.getElementById("clientName").value),
      phone: sanitizeText(document.getElementById("clientPhone").value),
      make: sanitizeText(document.getElementById("carMake").value),
      model: sanitizeText(document.getElementById("carModel").value),
      year: Number(document.getElementById("carYear").value),
      vin: sanitizeText(document.getElementById("vin").value),
      status: document.getElementById("statusSelect").value,
      notes: sanitizeText(document.getElementById("notes").value)
    };

    // simulate the network write, with loading state + retry-on-failure
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-spinner").hidden = false;
    formStatus.textContent = "Saving to the board…";
    formStatus.setAttribute("data-state", "");

    submitIntake(payload, 0);
  });

  function submitIntake(payload, attempt) {
    simulateNetworkFetch(payload, { failRate: 0.2 })
      .then(function () {
        state.projects.unshift(payload);
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-spinner").hidden = true;
        formStatus.textContent = "Added " + payload.year + " " + payload.make + " " + payload.model + " to the board.";
        formStatus.setAttribute("data-state", "success");
        intakeForm.reset();
        fieldConfig.forEach(function (cfg) { setFieldError(cfg.id, cfg.errId, ""); });
        renderBoard();
        renderGauges();
        showToast("Vehicle added to the board.");
        logAnalytics("intake_submitted", { status: payload.status });
      })
      .catch(function () {
        if (attempt < 1) {
          formStatus.textContent = "Connection dropped, retrying…";
          submitIntake(payload, attempt + 1);
        } else {
          submitBtn.disabled = false;
          submitBtn.querySelector(".btn-spinner").hidden = true;
          formStatus.textContent = "Couldn't save — check the connection and try again.";
          formStatus.setAttribute("data-state", "error");
          logAnalytics("intake_submit_failed");
        }
      });
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  loadBoard(false);
  renderGauges();
})();