(function () {
  "use strict";

  var STORAGE_KEY = "romere:entries";
  var LONG_PRESS_MS = 500;
  var EDIT_WINDOW_MS = 60 * 1000;

  var TILES = [
    { key: "diaper", icon: "🧷", label: "Diaper", kind: "quick" },
    { key: "feeding", icon: "🍼", label: "Feeding", kind: "quick" },
    { key: "foodDiary", icon: "🍽️", label: "Food Diary", kind: "foodDiary" },
    { key: "medication", icon: "💊", label: "Medication", kind: "quick" },
    { key: "note", icon: "📝", label: "Note", kind: "quick" },
    { key: "photo", icon: "📷", label: "Photo", kind: "photo" },
    { key: "vitals", icon: "❤️", label: "Vitals", kind: "quick" },
    { key: "surgery", icon: "🏥", label: "Surgery/Recovery", kind: "quick" }
  ];

  var STATUS_OPTIONS = {
    diaper: ["normal", "wet", "soiled", "both"],
    feeding: ["normal", "low intake", "refused", "great"],
    medication: ["given", "missed", "refused"],
    vitals: ["normal", "watch", "concerning"],
    surgery: ["stable", "improving", "needs attention"],
    note: ["normal"]
  };

  /* ---------- storage ---------- */
  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function addEntry(entry) {
    var entries = loadEntries();
    entries.unshift(entry);
    saveEntries(entries);
    return entry;
  }

  function updateEntry(id, patch) {
    var entries = loadEntries();
    var idx = entries.findIndex(function (e) { return e.id === id; });
    if (idx === -1) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    saveEntries(entries);
    return entries[idx];
  }

  function lastEntryOfType(type) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].type === type) return entries[i];
    }
    return null;
  }

  function makeId() {
    return "e_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- time helpers ---------- */
  function relativeTime(iso) {
    var diffMs = Date.now() - new Date(iso).getTime();
    var mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hrs / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }

  function formatClock(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- DOM refs ---------- */
  var tileGrid = document.getElementById("tile-grid");
  var entryList = document.getElementById("entry-list");
  var summaryChips = document.getElementById("summary-chips");
  var toastEl = document.getElementById("toast");
  var modalBackdrop = document.getElementById("modal-backdrop");
  var modal = document.getElementById("modal");
  var fab = document.getElementById("fab");

  /* ---------- toast ---------- */
  var toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 1600);
  }

  /* ---------- modal ---------- */
  function openModal(html) {
    modal.innerHTML = html;
    modalBackdrop.classList.add("open");
  }

  function closeModal() {
    modalBackdrop.classList.remove("open");
    modal.innerHTML = "";
  }

  modalBackdrop.addEventListener("click", function (e) {
    if (e.target === modalBackdrop) closeModal();
  });

  /* ---------- rendering: tiles ---------- */
  function renderTiles() {
    tileGrid.innerHTML = "";
    TILES.forEach(function (tile) {
      var last = lastEntryOfType(tile.key === "foodDiary" ? "foodDiary" : tile.key === "photo" ? "photo" : tile.key);
      var btn = document.createElement("button");
      btn.className = "tile";
      btn.dataset.key = tile.key;
      btn.innerHTML =
        '<span class="icon" aria-hidden="true">' + tile.icon + "</span>" +
        '<span class="label">' + tile.label + "</span>" +
        (last ? '<span class="sub">' + relativeTime(last.timestamp) + "</span>" : "");
      attachTileHandlers(btn, tile);
      tileGrid.appendChild(btn);
    });
  }

  function attachTileHandlers(btn, tile) {
    var pressTimer = null;
    var longPressed = false;

    btn.addEventListener("pointerdown", function () {
      longPressed = false;
      pressTimer = setTimeout(function () {
        longPressed = true;
        handleLongPress(tile);
      }, LONG_PRESS_MS);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach(function (evt) {
      btn.addEventListener(evt, function () {
        clearTimeout(pressTimer);
      });
    });

    btn.addEventListener("click", function () {
      if (longPressed) {
        longPressed = false;
        return;
      }
      handleTap(tile, btn);
    });
  }

  /* ---------- tap / long-press logic ---------- */
  function handleTap(tile, btn) {
    if (tile.kind === "foodDiary") return openFoodDiary();
    if (tile.kind === "photo") return openPhotoFlow();

    var last = lastEntryOfType(tile.key);
    var withinEditWindow = last && (Date.now() - new Date(last.timestamp).getTime()) < EDIT_WINDOW_MS;

    if (withinEditWindow) {
      openEditModal(tile, last);
      return;
    }

    var entry = {
      id: makeId(),
      type: tile.key,
      timestamp: new Date().toISOString(),
      status: "normal",
      note: ""
    };
    addEntry(entry);
    flashTile(btn);
    showToast("Saved!");
    renderAll();
  }

  function handleLongPress(tile) {
    if (tile.kind === "foodDiary") return openFoodDiary();
    if (tile.kind === "photo") return openPhotoFlow();
    var draft = {
      id: null,
      type: tile.key,
      timestamp: new Date().toISOString(),
      status: "normal",
      note: ""
    };
    openEditModal(tile, draft);
  }

  function flashTile(btn) {
    btn.classList.remove("flash");
    // force reflow so animation restarts
    void btn.offsetWidth;
    btn.classList.add("flash");
  }

  /* ---------- edit modal (quick-log tiles) ---------- */
  function openEditModal(tile, entry) {
    var statuses = STATUS_OPTIONS[tile.key] || ["normal"];
    var isNew = !entry.id;

    var pillsHtml = statuses.map(function (s) {
      var selected = s === entry.status ? " selected" : "";
      return '<button type="button" class="status-pill' + selected + '" data-status="' + s + '">' + s + "</button>";
    }).join("");

    openModal(
      "<h2>" + (isNew ? "Log " : "Edit ") + tile.label + "</h2>" +
      '<div class="field"><label>Time</label><input type="time" id="f-time" value="' + toTimeInputValue(entry.timestamp) + '" /></div>' +
      (statuses.length > 1
        ? '<div class="field"><label>Status</label><div class="status-pills" id="f-status">' + pillsHtml + "</div></div>"
        : "") +
      '<div class="field"><label>Note</label><textarea id="f-note" placeholder="Add an optional note...">' + escapeHtml(entry.note || "") + "</textarea></div>" +
      '<div class="modal-actions">' +
      (isNew ? "" : '<button class="btn btn--danger" id="f-delete">Delete</button>') +
      '<button class="btn btn--primary" id="f-save">Save</button>' +
      "</div>"
    );

    var selectedStatus = entry.status || (statuses[0] || "normal");
    var statusWrap = document.getElementById("f-status");
    if (statusWrap) {
      statusWrap.addEventListener("click", function (e) {
        var pill = e.target.closest(".status-pill");
        if (!pill) return;
        selectedStatus = pill.dataset.status;
        statusWrap.querySelectorAll(".status-pill").forEach(function (p) {
          p.classList.toggle("selected", p === pill);
        });
      });
    }

    var deleteBtn = document.getElementById("f-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        var entries = loadEntries().filter(function (e) { return e.id !== entry.id; });
        saveEntries(entries);
        closeModal();
        renderAll();
        showToast("Deleted");
      });
    }

    document.getElementById("f-save").addEventListener("click", function () {
      var timeVal = document.getElementById("f-time").value;
      var noteVal = document.getElementById("f-note").value;
      var ts = applyTimeInputValue(entry.timestamp, timeVal);
      var patch = { timestamp: ts, status: selectedStatus, note: noteVal };

      if (isNew) {
        addEntry(Object.assign({ id: makeId() }, entry, patch));
        showToast("Saved!");
      } else {
        updateEntry(entry.id, patch);
        showToast("Updated");
      }
      closeModal();
      renderAll();
    });
  }

  function toTimeInputValue(iso) {
    var d = new Date(iso);
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  function applyTimeInputValue(iso, timeVal) {
    var d = new Date(iso);
    if (timeVal) {
      var parts = timeVal.split(":");
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    }
    return d.toISOString();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- Food Diary flow ---------- */
  function openFoodDiary() {
    var entries = loadEntries().filter(isToday).filter(function (e) { return e.type === "foodDiary"; });
    var rows = entries.map(function (e) {
      return '<div class="entry-row"><span class="icon" aria-hidden="true">🍽️</span>' +
        '<div class="meta"><div class="type">' + escapeHtml(e.meal || "Meal") + "</div>" +
        '<div class="time">' + formatClock(e.timestamp) + (e.status ? " · " + escapeHtml(e.status) : "") + "</div>" +
        (e.note ? '<div class="note">' + escapeHtml(e.note) + "</div>" : "") +
        "</div></div>";
    }).join("") || '<div class="empty-state">No meals logged yet today.</div>';

    openModal(
      "<h2>Food Diary — Today</h2>" +
      '<div class="entry-list" style="margin-bottom:1rem;">' + rows + "</div>" +
      '<button class="btn btn--primary" id="fd-add" style="width:100%;">+ Add meal</button>'
    );

    document.getElementById("fd-add").addEventListener("click", openFoodDiaryAddForm);
  }

  function openFoodDiaryAddForm() {
    openModal(
      "<h2>Add meal</h2>" +
      '<div class="field"><label>Meal type</label>' +
      '<select id="fd-meal"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></div>' +
      '<div class="field"><label>Reaction / notes</label><textarea id="fd-note" placeholder="How did it go?"></textarea></div>' +
      '<div class="modal-actions"><button class="btn btn--primary" id="fd-save">Save meal</button></div>'
    );

    document.getElementById("fd-save").addEventListener("click", function () {
      addEntry({
        id: makeId(),
        type: "foodDiary",
        timestamp: new Date().toISOString(),
        status: "normal",
        meal: document.getElementById("fd-meal").value,
        note: document.getElementById("fd-note").value
      });
      showToast("Meal saved!");
      closeModal();
      renderAll();
    });
  }

  /* ---------- Photo flow ---------- */
  function openPhotoFlow() {
    openModal(
      "<h2>Add photo</h2>" +
      '<div class="field"><label>Choose a photo</label><input type="file" id="ph-file" accept="image/*" capture="environment" /></div>' +
      '<div class="field"><label>Tag</label><select id="ph-tag"><option value="Romere">Romere</option><option value="Appointment/Milestone">Appointment / Milestone</option></select></div>' +
      '<div class="field"><label>Title (optional)</label><input type="text" id="ph-title" placeholder="e.g. First smile" /></div>' +
      '<div class="modal-actions"><button class="btn btn--primary" id="ph-save">Save to album</button></div>'
    );

    document.getElementById("ph-save").addEventListener("click", function () {
      var fileInput = document.getElementById("ph-file");
      var tag = document.getElementById("ph-tag").value;
      var title = document.getElementById("ph-title").value;
      var file = fileInput.files && fileInput.files[0];

      function save(photoDataUrl) {
        addEntry({
          id: makeId(),
          type: "photo",
          timestamp: new Date().toISOString(),
          status: "normal",
          tag: tag,
          title: title,
          note: "",
          photoDataUrl: photoDataUrl || null
        });
        showToast("Saved to Romere album!");
        closeModal();
        renderAll();
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function () { save(reader.result); };
        reader.readAsDataURL(file);
      } else {
        save(null);
      }
    });
  }

  /* ---------- entry list (today's log) ---------- */
  function isToday(entry) {
    var d = new Date(entry.timestamp);
    var now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function tileFor(type) {
    return TILES.find(function (t) { return t.key === type; }) || { icon: "•", label: type };
  }

  function renderEntryList() {
    var today = loadEntries().filter(isToday);
    if (today.length === 0) {
      entryList.innerHTML = '<div class="empty-state">Nothing logged yet today — tap a tile above to get started.</div>';
      return;
    }
    entryList.innerHTML = today.map(function (e) {
      var tile = tileFor(e.type);
      var label = e.type === "photo" ? (e.title || "Photo") : e.type === "foodDiary" ? (e.meal || "Meal") : tile.label;
      var detail = [formatClock(e.timestamp)];
      if (e.status && e.status !== "normal") detail.push(e.status);
      return '<div class="entry-row" data-id="' + e.id + '"><span class="icon" aria-hidden="true">' + tile.icon + "</span>" +
        '<div class="meta"><div class="type">' + escapeHtml(label) + "</div>" +
        '<div class="time">' + detail.join(" · ") + "</div>" +
        (e.note ? '<div class="note">' + escapeHtml(e.note) + "</div>" : "") +
        "</div></div>";
    }).join("");

    entryList.querySelectorAll(".entry-row").forEach(function (row) {
      row.addEventListener("click", function () {
        var entry = loadEntries().find(function (e) { return e.id === row.dataset.id; });
        if (!entry) return;
        if (entry.type === "foodDiary" || entry.type === "photo") return;
        openEditModal(tileFor(entry.type), entry);
      });
    });
  }

  /* ---------- summary bar ---------- */
  function renderSummary() {
    var lastFeeding = lastEntryOfType("feeding");
    var lastDiaper = lastEntryOfType("diaper");
    var chips = [];
    chips.push(lastFeeding
      ? '<span class="chip">Last feeding: <strong>&nbsp;' + relativeTime(lastFeeding.timestamp) + "</strong></span>"
      : '<span class="chip">No feedings logged yet</span>');
    chips.push(lastDiaper
      ? '<span class="chip">Last diaper: <strong>&nbsp;' + relativeTime(lastDiaper.timestamp) + "</strong></span>"
      : '<span class="chip">No diapers logged yet</span>');
    chips.push('<span class="chip">Next appointment: <strong>&nbsp;none scheduled</strong></span>');
    summaryChips.innerHTML = chips.join("");
  }

  /* ---------- render all ---------- */
  function renderAll() {
    renderTiles();
    renderEntryList();
    renderSummary();
  }

  /* ---------- tab navigation ---------- */
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".nav-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
    });
  });

  /* ---------- FAB ---------- */
  fab.addEventListener("click", function () {
    openModal(
      "<h2>More actions</h2>" +
      '<div class="modal-actions" style="flex-direction:column;">' +
      '<button class="btn btn--ghost" id="fab-contact">+ Add new contact</button>' +
      '<button class="btn btn--ghost" id="fab-doc">+ Upload document</button>' +
      "</div>"
    );
    document.getElementById("fab-contact").addEventListener("click", function () {
      showToast("Contacts coming soon");
      closeModal();
    });
    document.getElementById("fab-doc").addEventListener("click", function () {
      showToast("Document vault coming soon");
      closeModal();
    });
  });

  /* ---------- service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---------- init ---------- */
  renderAll();
})();
