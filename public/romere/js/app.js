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

  /* ---------- appointments storage ---------- */
  var APPT_KEY = "romere:appointments";
  var MAX_TIMEOUT_MS = 24 * 24 * 60 * 60 * 1000; // setTimeout is unreliable past ~24.8 days
  var scheduledReminderIds = {};

  function loadAppointments() {
    try {
      return JSON.parse(localStorage.getItem(APPT_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveAppointments(list) {
    localStorage.setItem(APPT_KEY, JSON.stringify(list));
  }

  function addAppointment(appt) {
    var list = loadAppointments();
    list.push(appt);
    saveAppointments(list);
    return appt;
  }

  function updateAppointment(id, patch) {
    var list = loadAppointments();
    var idx = list.findIndex(function (a) { return a.id === id; });
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    saveAppointments(list);
    return list[idx];
  }

  function deleteAppointment(id) {
    saveAppointments(loadAppointments().filter(function (a) { return a.id !== id; }));
  }

  function apptDateTime(appt) {
    return new Date(appt.date + "T" + (appt.time || "00:00"));
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function sortedUpcomingAppointments() {
    var now = new Date();
    return loadAppointments()
      .filter(function (a) { return apptDateTime(a) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); })
      .sort(function (a, b) { return apptDateTime(a) - apptDateTime(b); });
  }

  function nextAppointment() {
    var now = new Date();
    var future = sortedUpcomingAppointments().filter(function (a) { return apptDateTime(a) >= now; });
    return future[0] || null;
  }

  function formatApptWhen(appt) {
    var d = apptDateTime(appt);
    var today = todayStr();
    var dayLabel = appt.date === today ? "Today" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return dayLabel + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- reminder scheduling (best-effort, in-page only) ---------- */
  function scheduleReminder(appt) {
    if (!appt.reminder || scheduledReminderIds[appt.id]) return;
    var msUntil = apptDateTime(appt).getTime() - Date.now();
    if (msUntil <= 0 || msUntil > MAX_TIMEOUT_MS) return;
    scheduledReminderIds[appt.id] = true;
    setTimeout(function () {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Romere's Room", { body: appt.title + " — " + formatApptWhen(appt) });
      } else {
        showToast("Reminder: " + appt.title);
      }
    }, msUntil);
  }

  function scheduleAllReminders() {
    sortedUpcomingAppointments().forEach(scheduleReminder);
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
    var next = nextAppointment();
    chips.push(next
      ? '<span class="chip">Next appointment: <strong>&nbsp;' + escapeHtml(next.title) + " · " + formatApptWhen(next) + "</strong></span>"
      : '<span class="chip">Next appointment: <strong>&nbsp;none scheduled</strong></span>');
    summaryChips.innerHTML = chips.join("");
  }

  /* ---------- Calendar ---------- */
  var calendarTodayEl = document.getElementById("calendar-today");
  var calendarUpcomingEl = document.getElementById("calendar-upcoming");
  var calendarAddBtn = document.getElementById("calendar-add");

  function renderApptRow(appt) {
    return '<div class="entry-row" data-id="' + appt.id + '"><span class="icon" aria-hidden="true">' + (appt.reminder ? "🔔" : "🗓️") + "</span>" +
      '<div class="meta"><div class="type">' + escapeHtml(appt.title) + "</div>" +
      '<div class="time">' + formatApptWhen(appt) + "</div>" +
      (appt.notes ? '<div class="note">' + escapeHtml(appt.notes) + "</div>" : "") +
      "</div></div>";
  }

  function renderCalendar() {
    if (!calendarTodayEl || !calendarUpcomingEl) return;
    var all = loadAppointments().sort(function (a, b) { return apptDateTime(a) - apptDateTime(b); });
    var today = todayStr();
    var todays = all.filter(function (a) { return a.date === today; });
    var upcoming = all.filter(function (a) { return a.date > today; });

    calendarTodayEl.innerHTML = todays.length
      ? todays.map(renderApptRow).join("")
      : '<div class="empty-state">Nothing scheduled today.</div>';

    calendarUpcomingEl.innerHTML = upcoming.length
      ? upcoming.map(renderApptRow).join("")
      : '<div class="empty-state">No upcoming appointments — tap "+ Add" to schedule one.</div>';

    [calendarTodayEl, calendarUpcomingEl].forEach(function (list) {
      list.querySelectorAll(".entry-row").forEach(function (row) {
        row.addEventListener("click", function () {
          var appt = loadAppointments().find(function (a) { return a.id === row.dataset.id; });
          if (appt) openAppointmentForm(appt);
        });
      });
    });
  }

  function openAppointmentForm(existing) {
    var appt = existing || { id: null, title: "", date: todayStr(), time: "09:00", notes: "", reminder: true };
    var isNew = !appt.id;

    openModal(
      "<h2>" + (isNew ? "Add" : "Edit") + " appointment</h2>" +
      '<div class="field"><label>Title</label><input type="text" id="ap-title" placeholder="e.g. Cardiology follow-up" value="' + escapeHtml(appt.title) + '" /></div>' +
      '<div class="field"><label>Date</label><input type="date" id="ap-date" value="' + appt.date + '" /></div>' +
      '<div class="field"><label>Time</label><input type="time" id="ap-time" value="' + appt.time + '" /></div>' +
      '<div class="field"><label>Notes</label><textarea id="ap-notes" placeholder="Optional details">' + escapeHtml(appt.notes || "") + "</textarea></div>" +
      '<div class="field"><label><input type="checkbox" id="ap-reminder" ' + (appt.reminder ? "checked" : "") + ' style="width:auto;margin-right:0.5rem;" />Remind me</label></div>' +
      '<div class="modal-actions">' +
      (isNew ? "" : '<button class="btn btn--danger" id="ap-delete">Delete</button>') +
      '<button class="btn btn--primary" id="ap-save">Save</button>' +
      "</div>"
    );

    var deleteBtn = document.getElementById("ap-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        deleteAppointment(appt.id);
        closeModal();
        renderAll();
        showToast("Appointment removed");
      });
    }

    document.getElementById("ap-save").addEventListener("click", function () {
      var title = document.getElementById("ap-title").value.trim();
      if (!title) return;
      var patch = {
        title: title,
        date: document.getElementById("ap-date").value,
        time: document.getElementById("ap-time").value,
        notes: document.getElementById("ap-notes").value,
        reminder: document.getElementById("ap-reminder").checked
      };

      if (patch.reminder && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      var saved;
      if (isNew) {
        saved = Object.assign({ id: makeId() }, patch);
        addAppointment(saved);
        showToast("Appointment saved!");
      } else {
        saved = updateAppointment(appt.id, patch);
        showToast("Appointment updated");
      }
      if (saved) scheduleReminder(saved);
      closeModal();
      renderAll();
    });
  }

  if (calendarAddBtn) {
    calendarAddBtn.addEventListener("click", function () { openAppointmentForm(); });
  }

  /* ---------- Gallery ---------- */
  var galleryFilter = "all";
  var galleryGrid = document.getElementById("gallery-grid");
  var galleryFilters = document.getElementById("gallery-filters");
  var galleryAddBtn = document.getElementById("gallery-add");

  function renderGallery() {
    if (!galleryGrid) return;
    var photos = loadEntries()
      .filter(function (e) { return e.type === "photo"; })
      .filter(function (e) { return galleryFilter === "all" || e.tag === galleryFilter; });

    if (photos.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No photos yet — tap "+ Add photo" to start Romere\'s album.</div>';
      return;
    }

    galleryGrid.innerHTML = photos.map(function (e) {
      var badge = e.tag === "Appointment/Milestone" ? "Milestone" : "";
      var inner = e.photoDataUrl
        ? '<img src="' + e.photoDataUrl + '" alt="' + escapeHtml(e.title || "Romere") + '" />'
        : '<div class="no-photo"><span class="icon" aria-hidden="true">📷</span><span class="title">' + escapeHtml(e.title || "Untitled") + "</span></div>";
      return '<button type="button" class="gallery-tile" data-id="' + e.id + '">' +
        inner +
        (badge ? '<span class="tag-badge">' + badge + "</span>" : "") +
        (e.title ? '<span class="caption">' + escapeHtml(e.title) + "</span>" : "") +
        "</button>";
    }).join("");

    galleryGrid.querySelectorAll(".gallery-tile").forEach(function (tile) {
      tile.addEventListener("click", function () {
        var entry = loadEntries().find(function (e) { return e.id === tile.dataset.id; });
        if (entry) openLightbox(entry);
      });
    });
  }

  function openLightbox(entry) {
    openModal(
      (entry.photoDataUrl ? '<img class="lightbox-photo" src="' + entry.photoDataUrl + '" alt="' + escapeHtml(entry.title || "Romere") + '" />' : "") +
      "<h2>" + escapeHtml(entry.title || "Untitled photo") + "</h2>" +
      '<div class="lightbox-meta"><span>' + escapeHtml(entry.tag || "Romere") + "</span><span>·</span><span>" + formatClock(entry.timestamp) + " on " + new Date(entry.timestamp).toLocaleDateString() + "</span></div>" +
      (entry.note ? '<p style="margin-bottom:0.9rem;color:var(--ink-soft);font-size:0.88rem;">' + escapeHtml(entry.note) + "</p>" : "") +
      '<div class="modal-actions"><button class="btn btn--danger" id="lb-delete">Delete</button><button class="btn btn--primary" id="lb-close">Close</button></div>'
    );

    document.getElementById("lb-close").addEventListener("click", closeModal);
    document.getElementById("lb-delete").addEventListener("click", function () {
      var entries = loadEntries().filter(function (e) { return e.id !== entry.id; });
      saveEntries(entries);
      closeModal();
      renderAll();
      showToast("Photo deleted");
    });
  }

  if (galleryFilters) {
    galleryFilters.addEventListener("click", function (e) {
      var pill = e.target.closest(".filter-pill");
      if (!pill) return;
      galleryFilter = pill.dataset.filter;
      galleryFilters.querySelectorAll(".filter-pill").forEach(function (p) {
        p.classList.toggle("selected", p === pill);
      });
      renderGallery();
    });
  }

  if (galleryAddBtn) {
    galleryAddBtn.addEventListener("click", openPhotoFlow);
  }

  /* ---------- Medical / PDX Tracker ---------- */
  var JOURNEY_KEY = "romere:journey";
  var CHECKIN_KEY = "romere:checkins";
  var medicalContent = document.getElementById("medical-content");

  function loadJourney() {
    try {
      return JSON.parse(localStorage.getItem(JOURNEY_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveJourney(journey) {
    localStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
  }

  function loadCheckins() {
    try {
      return JSON.parse(localStorage.getItem(CHECKIN_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCheckins(list) {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(list));
  }

  function checkinForDate(dateStr) {
    return loadCheckins().find(function (c) { return c.date === dateStr; }) || null;
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function daysBetween(fromStr, toStr) {
    var from = new Date(fromStr + "T00:00:00");
    var to = new Date(toStr + "T00:00:00");
    return Math.round((to - from) / 86400000);
  }

  function dayInfo(journey, dateStr) {
    var offset = daysBetween(journey.surgeryDate, dateStr);
    if (offset < 0) return { phase: "pre-op", icon: "🩺", label: "Pre-op Day " + offset };
    if (offset === 0) return { phase: "surgery", icon: "🏥", label: "Surgery Day" };
    return { phase: "recovery", icon: "💙", label: "Recovery Day " + offset };
  }

  function renderMedical() {
    if (!medicalContent) return;
    var journey = loadJourney();

    if (!journey) {
      medicalContent.innerHTML =
        '<div class="medical-setup">' +
        "<h2>Set up the PDX Tracker</h2>" +
        "<p>Enter Romere's surgery date to build the pre-op / surgery / recovery timeline for the stay.</p>" +
        '<div class="field"><label>Surgery date</label><input type="date" id="journey-surgery-date" value="' + todayStr() + '" /></div>' +
        '<div class="field"><label>Pre-op days to show</label><input type="number" id="journey-preop-days" value="3" min="0" max="14" /></div>' +
        '<div class="field"><label>Recovery weeks to show</label><input type="number" id="journey-recovery-weeks" value="6" min="1" max="12" /></div>' +
        '<button class="btn btn--primary" id="journey-save" style="width:100%;">Start tracking</button>' +
        "</div>";

      document.getElementById("journey-save").addEventListener("click", function () {
        var surgeryDate = document.getElementById("journey-surgery-date").value;
        if (!surgeryDate) return;
        saveJourney({
          surgeryDate: surgeryDate,
          preOpDays: parseInt(document.getElementById("journey-preop-days").value, 10) || 0,
          recoveryWeeks: parseInt(document.getElementById("journey-recovery-weeks").value, 10) || 6
        });
        renderMedical();
      });
      return;
    }

    var today = todayStr();
    var info = dayInfo(journey, today);
    var startDate = addDays(journey.surgeryDate, -journey.preOpDays);
    var endDate = addDays(journey.surgeryDate, journey.recoveryWeeks * 7);
    var totalDays = daysBetween(startDate, endDate) + 1;

    var rows = "";
    for (var i = 0; i < totalDays; i++) {
      var d = addDays(startDate, i);
      var di = dayInfo(journey, d);
      var checkin = checkinForDate(d);
      var isToday = d === today;
      rows += '<button type="button" class="timeline-row phase-' + di.phase + (isToday ? " is-today" : "") + '" data-date="' + d + '">' +
        '<span class="day-icon" aria-hidden="true">' + di.icon + "</span>" +
        '<span class="day-meta"><span class="day-label">' + di.label + "</span>" +
        '<span class="day-date">' + new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + "</span></span>" +
        (checkin ? '<span class="day-check">✓ checked in</span>' : "") +
        "</button>";
    }

    medicalContent.innerHTML =
      '<div class="medical-header"><span class="phase-badge">' + info.phase.replace("-", " ") + '</span>' +
      "<h2>" + info.label + "</h2>" +
      "<p>Surgery date: " + new Date(journey.surgeryDate + "T00:00:00").toLocaleDateString() + "</p></div>" +
      '<div class="medical-actions">' +
      '<button class="btn btn--primary" id="medical-checkin">Check in for today</button>' +
      '<button class="btn btn--ghost" id="medical-report">Share Report</button>' +
      "</div>" +
      '<p class="section-label">Timeline</p>' +
      '<div class="timeline-list" id="medical-timeline">' + rows + "</div>";

    document.getElementById("medical-checkin").addEventListener("click", function () {
      openCheckinForm(today, journey);
    });
    document.getElementById("medical-report").addEventListener("click", function () {
      generateMedicalReport(journey);
    });
    document.getElementById("medical-timeline").querySelectorAll(".timeline-row").forEach(function (row) {
      row.addEventListener("click", function () {
        openCheckinForm(row.dataset.date, journey);
      });
    });

    var todayRow = document.querySelector(".timeline-row.is-today");
    if (todayRow) todayRow.scrollIntoView({ block: "center" });
  }

  function openCheckinForm(dateStr, journey) {
    var existing = checkinForDate(dateStr) || { date: dateStr, vitals: "", medsTaken: "", doctorsAdvice: "", momsNotes: "" };
    var info = dayInfo(journey, dateStr);

    openModal(
      "<h2>" + info.label + " — Check-in</h2>" +
      '<p style="color:var(--ink-soft);font-size:0.85rem;margin-bottom:0.9rem;">How is Romere today?</p>' +
      '<div class="field"><label>Vitals</label><input type="text" id="ci-vitals" placeholder="e.g. Temp 98.6°F, HR 110" value="' + escapeHtml(existing.vitals || "") + '" /></div>' +
      '<div class="field"><label>Meds taken</label><input type="text" id="ci-meds" placeholder="e.g. Amoxicillin 8am/2pm/8pm" value="' + escapeHtml(existing.medsTaken || "") + '" /></div>' +
      "<div class=\"field\"><label>Doctor's advice</label><textarea id=\"ci-advice\" placeholder=\"What the care team said today\">" + escapeHtml(existing.doctorsAdvice || "") + "</textarea></div>" +
      '<div class="field"><label>Mom\'s notes</label><textarea id="ci-notes" placeholder="How you\'re both doing">' + escapeHtml(existing.momsNotes || "") + "</textarea></div>" +
      '<div class="modal-actions"><button class="btn btn--primary" id="ci-save">Save check-in</button></div>'
    );

    document.getElementById("ci-save").addEventListener("click", function () {
      var patch = {
        date: dateStr,
        vitals: document.getElementById("ci-vitals").value,
        medsTaken: document.getElementById("ci-meds").value,
        doctorsAdvice: document.getElementById("ci-advice").value,
        momsNotes: document.getElementById("ci-notes").value
      };
      var list = loadCheckins();
      var idx = list.findIndex(function (c) { return c.date === dateStr; });
      if (idx === -1) {
        list.push(Object.assign({ id: makeId() }, patch));
      } else {
        list[idx] = Object.assign({}, list[idx], patch);
      }
      saveCheckins(list);
      showToast("Check-in saved");
      closeModal();
      renderMedical();
    });
  }

  function generateMedicalReport(journey) {
    var checkins = loadCheckins().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var reportEl = document.getElementById("print-report");
    if (!reportEl) return;

    var body = checkins.map(function (c) {
      var info = dayInfo(journey, c.date);
      return '<div class="report-day"><h3>' + info.label + " — " + new Date(c.date + "T00:00:00").toLocaleDateString() + "</h3>" +
        "<dl>" +
        "<dt>Vitals</dt><dd>" + escapeHtml(c.vitals || "—") + "</dd>" +
        "<dt>Meds taken</dt><dd>" + escapeHtml(c.medsTaken || "—") + "</dd>" +
        "<dt>Doctor's advice</dt><dd>" + escapeHtml(c.doctorsAdvice || "—") + "</dd>" +
        "<dt>Mom's notes</dt><dd>" + escapeHtml(c.momsNotes || "—") + "</dd>" +
        "</dl></div>";
    }).join("");

    reportEl.innerHTML =
      "<h1>Romere's Room — Medical Report</h1>" +
      '<p class="report-meta">Surgery date: ' + new Date(journey.surgeryDate + "T00:00:00").toLocaleDateString() +
      " · Generated " + new Date().toLocaleString() + " · " + checkins.length + " check-in(s)</p>" +
      (body || "<p>No check-ins recorded yet.</p>");

    window.print();
  }

  /* ---------- render all ---------- */
  function renderAll() {
    renderTiles();
    renderEntryList();
    renderSummary();
    renderGallery();
    renderCalendar();
    renderMedical();
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
  scheduleAllReminders();
})();
