(function () {
  "use strict";

  var statuses = [
    "Pending Review",
    "Approved",
    "Scheduled",
    "In Progress",
    "Completed",
    "On Hold",
    "Changes Requested",
    "Cancelled"
  ];
  var weekStart = "2026-06-22";
  var activeView = "week";
  var selectedEventId = "LB2-2026-0054";
  var activePopoverEventId = "";
  var closePopoverTimer = null;
  var filterState = {
    search: "",
    status: "",
    pi: ""
  };

  var calendarEvents = [
    {
      id: "LB2-2026-0052",
      sequence: "H-KLVFFAE-OH",
      piLab: "Hematian Lab",
      requester: "Example reviewer",
      scale: "0.10 mmol",
      status: "Completed",
      targetDate: "2026-06-22",
      estimatedCost: 312.45,
      operator: "Winston Pitts",
      date: "2026-06-22",
      startTime: "09:00",
      runtimeMinutes: 180,
      priority: "Normal",
      approvedDate: "2026-06-15",
      instrumentStatus: "Ready",
      notes: "Run completed; archive final cost after QC review."
    },
    {
      id: "LB2-2026-0053",
      sequence: "GRKKRRQRRR-NH2",
      piLab: "Signal Peptides Core",
      requester: "M. Rivera",
      scale: "0.10 mmol",
      status: "In Progress",
      targetDate: "2026-06-24",
      estimatedCost: 428.9,
      operator: "Hematian Lab Admin",
      date: "2026-06-23",
      startTime: "08:30",
      runtimeMinutes: 270,
      priority: "High",
      approvedDate: "2026-06-16",
      instrumentStatus: "Ready",
      notes: "Arginine-rich sequence; monitor deprotection solution volume."
    },
    {
      id: "LB2-2026-0054",
      sequence: "Ac-WFEPKLGG-OH",
      piLab: "Neurobiology Lab",
      requester: "T. Nguyen",
      scale: "0.10 mmol",
      status: "Scheduled",
      targetDate: "2026-06-25",
      estimatedCost: 356.75,
      operator: "Example Reviewer",
      date: "2026-06-24",
      startTime: "10:00",
      runtimeMinutes: 240,
      priority: "Normal",
      approvedDate: "2026-06-17",
      instrumentStatus: "Ready",
      notes: "Standard method. Confirm C-terminal form before synthesis."
    },
    {
      id: "LB2-2026-0056",
      sequence: "Ac-GILLYK-NH2",
      piLab: "Hematian Lab",
      requester: "Winston Pitts",
      scale: "0.10 mmol",
      status: "Pending Review",
      targetDate: "2026-06-25",
      estimatedCost: 284.2,
      operator: "Unassigned",
      date: "2026-06-25",
      startTime: "13:00",
      runtimeMinutes: 90,
      priority: "Urgent",
      approvedDate: "",
      instrumentStatus: "Needs setup",
      notes: "Target date approaching; review sequence and requester-supplied amino-acid note."
    },
    {
      id: "LB2-2026-0057",
      sequence: "KDFSVDPSGNIPIYHG",
      piLab: "Protein Design Lab",
      requester: "A. Chen",
      scale: "0.10 mmol",
      status: "Approved",
      targetDate: "2026-06-27",
      estimatedCost: 612.5,
      operator: "Unassigned",
      date: "2026-06-26",
      startTime: "09:30",
      runtimeMinutes: 330,
      priority: "High",
      approvedDate: "2026-06-19",
      instrumentStatus: "Ready",
      notes: "Longer sequence; reserve extended method window."
    },
    {
      id: "LB2-2026-0058",
      sequence: "FFPVSGK",
      piLab: "Outside Lab",
      requester: "Example requester",
      scale: "0.10 mmol",
      status: "Approved",
      targetDate: "2026-06-30",
      estimatedCost: 244.65,
      operator: "Unassigned",
      date: "2026-06-26",
      startTime: "13:30",
      runtimeMinutes: 180,
      priority: "Normal",
      approvedDate: "2026-06-20",
      instrumentStatus: "Ready",
      notes: "Candidate for afternoon instrument slot."
    }
  ];

  var operators = [
    { name: "Winston Pitts", availability: "Available", note: "Primary operator for morning runs" },
    { name: "Hematian Lab Admin", availability: "Limited", note: "Available after 1:00 PM" },
    { name: "Example Reviewer", availability: "Unavailable", note: "Out for training block" }
  ];

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function asNumber(value, fallback) {
    var parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  function dateLabel(value) {
    if (!value) {
      return "Not set";
    }
    var date = new Date(value + "T12:00:00");
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function dayShortLabel(value) {
    var date = new Date(value + "T12:00:00");
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  function addDays(dateString, days) {
    var date = new Date(dateString + "T12:00:00");
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function minutesFromTime(value) {
    var parts = String(value || "00:00").split(":");
    return asNumber(parts[0], 0) * 60 + asNumber(parts[1], 0);
  }

  function timeFromMinutes(totalMinutes) {
    var hours = Math.floor(totalMinutes / 60) % 24;
    var minutes = totalMinutes % 60;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function timeLabel(value) {
    var date = new Date("2026-01-01T" + value + ":00");
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function runtimeLabel(minutes) {
    var hours = Math.floor(minutes / 60);
    var remainder = minutes % 60;
    if (hours && remainder) {
      return hours + "h " + remainder + "m";
    }
    if (hours) {
      return hours + "h";
    }
    return remainder + "m";
  }

  function parseRuntime(value) {
    var text = String(value || "").toLowerCase();
    var hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
    var minutesMatch = text.match(/(\d+)\s*m/);
    if (hoursMatch || minutesMatch) {
      return Math.round(asNumber(hoursMatch && hoursMatch[1], 0) * 60 + asNumber(minutesMatch && minutesMatch[1], 0));
    }
    return Math.max(30, Math.round(asNumber(text, 180)));
  }

  function eventEndTime(event) {
    return timeFromMinutes(minutesFromTime(event.startTime) + event.runtimeMinutes);
  }

  function timeWindow(event) {
    return timeLabel(event.startTime) + " - " + timeLabel(eventEndTime(event));
  }

  function statusClass(status) {
    return "status-" + String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function priorityClass(priority) {
    if (priority === "Urgent" || priority === "High") {
      return "priority-high";
    }
    if (priority === "Low") {
      return "priority-low";
    }
    return "priority-standard";
  }

  function eventById(id) {
    return calendarEvents.find(function (event) {
      return event.id === id;
    });
  }

  function uniquePiLabs() {
    return Array.from(new Set(calendarEvents.map(function (event) {
      return event.piLab;
    }))).sort();
  }

  function getFilteredEvents() {
    var search = filterState.search.trim().toLowerCase();
    return calendarEvents.filter(function (event) {
      var matchesSearch = !search || [
        event.id,
        event.sequence,
        event.piLab,
        event.requester,
        event.operator,
        event.notes
      ].join(" ").toLowerCase().indexOf(search) !== -1;
      var matchesStatus = !filterState.status || event.status === filterState.status;
      var matchesPi = !filterState.pi || event.piLab === filterState.pi;
      return matchesSearch && matchesStatus && matchesPi;
    });
  }

  function weekDates() {
    return [0, 1, 2, 3, 4].map(function (offset) {
      return addDays(weekStart, offset);
    });
  }

  function renderSummary() {
    var grid = document.getElementById("calendarSummaryGrid");
    if (!grid) {
      return;
    }
    var week = weekDates();
    var cards = [
      {
        label: "Approved Awaiting Schedule",
        value: calendarEvents.filter(function (event) {
          return event.status === "Approved";
        }).length,
        detail: "Ready for operator assignment",
        tone: "is-blue"
      },
      {
        label: "Scheduled This Week",
        value: calendarEvents.filter(function (event) {
          return week.indexOf(event.date) !== -1 && event.status !== "Cancelled";
        }).length,
        detail: "Mock Liberty Blue run tiles",
        tone: "is-green"
      },
      {
        label: "In Progress",
        value: calendarEvents.filter(function (event) {
          return event.status === "In Progress";
        }).length,
        detail: "Currently active runs",
        tone: "is-amber"
      },
      {
        label: "Upcoming Deadlines",
        value: calendarEvents.filter(function (event) {
          return event.status !== "Completed" && event.status !== "Cancelled";
        }).length,
        detail: "Open targets in date order",
        tone: "is-blue"
      },
      {
        label: "Schedule Conflicts",
        value: countScheduleConflicts(),
        detail: "Same-day overlapping windows",
        tone: countScheduleConflicts() ? "is-red" : "is-blue"
      }
    ];

    grid.innerHTML = cards.map(function (card) {
      return [
        "<article class=\"summary-card " + card.tone + "\">",
        "<span>" + escapeHtml(card.label) + "</span>",
        "<strong>" + escapeHtml(card.value) + "</strong>",
        "<small>" + escapeHtml(card.detail) + "</small>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderFilterOptions() {
    var statusFilter = document.getElementById("calendarStatusFilter");
    var piFilter = document.getElementById("calendarPiFilter");

    if (statusFilter) {
      statusFilter.innerHTML = "<option value=\"\">All statuses</option>" + statuses.map(function (status) {
        return "<option value=\"" + escapeHtml(status) + "\">" + escapeHtml(status) + "</option>";
      }).join("");
    }
    if (piFilter) {
      piFilter.innerHTML = "<option value=\"\">All PIs / labs</option>" + uniquePiLabs().map(function (piLab) {
        return "<option value=\"" + escapeHtml(piLab) + "\">" + escapeHtml(piLab) + "</option>";
      }).join("");
    }
  }

  function eventTile(event) {
    return [
      "<button class=\"calendar-event-tile " + statusClass(event.status) + "\" type=\"button\" data-event-id=\"" + escapeHtml(event.id) + "\" aria-describedby=\"calendarEventPopover\">",
      "<span class=\"calendar-event-id\">" + escapeHtml(event.id) + "</span>",
      "<span class=\"calendar-event-sequence\">" + escapeHtml(event.sequence) + "</span>",
      "<span class=\"status-badge " + statusClass(event.status) + "\">" + escapeHtml(event.status) + "</span>",
      "<span class=\"calendar-event-time\">" + escapeHtml(timeWindow(event)) + "</span>",
      "</button>"
    ].join("");
  }

  function renderWeekView(events) {
    var days = weekDates();
    return [
      "<div class=\"calendar-week-grid\" role=\"grid\" aria-label=\"Week calendar\">",
      days.map(function (date) {
        var dayEvents = events.filter(function (event) {
          return event.date === date;
        }).sort(function (a, b) {
          return minutesFromTime(a.startTime) - minutesFromTime(b.startTime);
        });
        return [
          "<section class=\"calendar-day-column\" role=\"gridcell\" aria-label=\"" + escapeHtml(dayShortLabel(date)) + "\">",
          "<header class=\"calendar-day-header\"><span>" + escapeHtml(dayShortLabel(date)) + "</span><strong>" + dayEvents.length + "</strong></header>",
          "<div class=\"calendar-day-events\">",
          dayEvents.length ? dayEvents.map(eventTile).join("") : "<p class=\"calendar-empty-day\">Open instrument window</p>",
          "</div>",
          "</section>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderMonthView(events) {
    var days = [];
    for (var i = -7; i < 28; i += 1) {
      days.push(addDays(weekStart, i));
    }
    return [
      "<div class=\"calendar-month-grid\" aria-label=\"Month calendar\">",
      days.map(function (date) {
        var dayEvents = events.filter(function (event) {
          return event.date === date;
        });
        return [
          "<section class=\"calendar-month-day\">",
          "<header>" + escapeHtml(dayShortLabel(date)) + "</header>",
          dayEvents.slice(0, 2).map(eventTile).join(""),
          dayEvents.length > 2 ? "<p class=\"mock-note\">+" + (dayEvents.length - 2) + " more</p>" : "",
          "</section>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderListView(events) {
    if (!events.length) {
      return "<div class=\"calendar-list-view\"></div>";
    }
    return [
      "<div class=\"calendar-list-view\" aria-label=\"List calendar\">",
      events.slice().sort(function (a, b) {
        return (a.date + a.startTime).localeCompare(b.date + b.startTime);
      }).map(function (event) {
        return [
          "<article class=\"calendar-list-row\">",
          "<div><strong>" + escapeHtml(event.id) + "</strong><span>" + escapeHtml(event.sequence) + "</span></div>",
          "<div><span>" + escapeHtml(dayShortLabel(event.date)) + "</span><strong>" + escapeHtml(timeWindow(event)) + "</strong></div>",
          "<span class=\"status-badge " + statusClass(event.status) + "\">" + escapeHtml(event.status) + "</span>",
          "<button class=\"admin-link-button\" type=\"button\" data-event-id=\"" + escapeHtml(event.id) + "\" data-action=\"schedule\">Schedule/Edit</button>",
          "</article>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderCalendar() {
    var shell = document.getElementById("calendarViewShell");
    var emptyState = document.getElementById("calendarEmptyState");
    var periodLabel = document.getElementById("calendarPeriodLabel");
    var viewNote = document.getElementById("calendarViewNote");
    if (!shell) {
      return;
    }

    var events = getFilteredEvents();
    if (emptyState) {
      emptyState.hidden = events.length > 0;
    }
    if (periodLabel) {
      periodLabel.textContent = activeView === "month"
        ? "Mock month around " + dateLabel(weekStart)
        : "Week of " + dateLabel(weekStart);
    }
    if (viewNote) {
      viewNote.textContent = activeView === "week"
        ? "Week view: Monday through Friday instrument schedule"
        : activeView.charAt(0).toUpperCase() + activeView.slice(1) + " view";
    }

    if (activeView === "month") {
      shell.innerHTML = renderMonthView(events);
    } else if (activeView === "list") {
      shell.innerHTML = renderListView(events);
    } else {
      shell.innerHTML = renderWeekView(events);
    }
  }

  function renderApprovedTable() {
    var body = document.getElementById("approvedScheduleTableBody");
    if (!body) {
      return;
    }
    var approved = calendarEvents.filter(function (event) {
      return event.status === "Approved";
    }).sort(function (a, b) {
      return a.targetDate.localeCompare(b.targetDate);
    });
    body.innerHTML = approved.map(function (event) {
      return [
        "<tr>",
        "<td data-label=\"Request ID\">" + escapeHtml(event.id) + "</td>",
        "<td data-label=\"Peptide Sequence\"><code>" + escapeHtml(event.sequence) + "</code></td>",
        "<td data-label=\"PI / Lab\">" + escapeHtml(event.piLab) + "</td>",
        "<td data-label=\"Scale\">" + escapeHtml(event.scale) + "</td>",
        "<td data-label=\"Approved Date\">" + escapeHtml(dateLabel(event.approvedDate)) + "</td>",
        "<td data-label=\"Target Date\">" + escapeHtml(dateLabel(event.targetDate)) + "</td>",
        "<td data-label=\"Estimated Runtime\">" + escapeHtml(runtimeLabel(event.runtimeMinutes)) + "</td>",
        "<td data-label=\"Priority\"><span class=\"priority-pill " + priorityClass(event.priority) + "\">" + escapeHtml(event.priority) + "</span></td>",
        "<td data-label=\"Actions\"><div class=\"row-actions\"><button class=\"admin-link-button\" type=\"button\" data-action=\"schedule\" data-event-id=\"" + escapeHtml(event.id) + "\">Schedule</button><button class=\"admin-link-button\" type=\"button\" data-action=\"view\" data-event-id=\"" + escapeHtml(event.id) + "\">View</button></div></td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderDeadlines() {
    var list = document.getElementById("deadlineCardList");
    if (!list) {
      return;
    }
    var upcoming = calendarEvents.filter(function (event) {
      return event.status !== "Completed" && event.status !== "Cancelled";
    }).sort(function (a, b) {
      return a.targetDate.localeCompare(b.targetDate);
    });
    list.innerHTML = upcoming.map(function (event) {
      return [
        "<article class=\"deadline-card\">",
        "<div><strong>" + escapeHtml(event.id) + "</strong><code>" + escapeHtml(event.sequence) + "</code></div>",
        "<span>" + escapeHtml(dateLabel(event.targetDate)) + "</span>",
        "<div><span class=\"status-badge " + statusClass(event.status) + "\">" + escapeHtml(event.status) + "</span><span class=\"priority-pill " + priorityClass(event.priority) + "\">" + escapeHtml(event.priority) + "</span></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderOperators() {
    var list = document.getElementById("operatorAvailabilityList");
    if (!list) {
      return;
    }
    list.innerHTML = operators.map(function (operator) {
      return [
        "<article class=\"operator-row\">",
        "<div><strong>" + escapeHtml(operator.name) + "</strong><span>" + escapeHtml(operator.note) + "</span></div>",
        "<span class=\"availability-badge availability-" + escapeHtml(operator.availability.toLowerCase()) + "\">" + escapeHtml(operator.availability) + "</span>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderAll() {
    renderSummary();
    renderCalendar();
    renderApprovedTable();
    renderDeadlines();
    renderOperators();
  }

  function popoverHtml(event) {
    return [
      "<div class=\"popover-header\"><strong>" + escapeHtml(event.id) + "</strong><span class=\"status-badge " + statusClass(event.status) + "\">" + escapeHtml(event.status) + "</span></div>",
      "<div class=\"popover-sequence\"><code>" + escapeHtml(event.sequence) + "</code></div>",
      "<dl class=\"popover-details\">",
      "<div><dt>PI / Lab</dt><dd>" + escapeHtml(event.piLab) + "</dd></div>",
      "<div><dt>Requester</dt><dd>" + escapeHtml(event.requester) + "</dd></div>",
      "<div><dt>Scale</dt><dd>" + escapeHtml(event.scale) + "</dd></div>",
      "<div><dt>Target completion</dt><dd>" + escapeHtml(dateLabel(event.targetDate)) + "</dd></div>",
      "<div><dt>Estimated cost</dt><dd>" + escapeHtml(money(event.estimatedCost)) + "</dd></div>",
      "<div><dt>Operator</dt><dd>" + escapeHtml(event.operator) + "</dd></div>",
      "<div><dt>Time window</dt><dd>" + escapeHtml(timeWindow(event)) + "</dd></div>",
      "</dl>",
      "<p>" + escapeHtml(event.notes) + "</p>",
      "<div class=\"popover-actions\">",
      "<button class=\"admin-link-button\" type=\"button\" data-action=\"view\" data-event-id=\"" + escapeHtml(event.id) + "\">View Request</button>",
      "<button class=\"admin-button\" type=\"button\" data-action=\"schedule\" data-event-id=\"" + escapeHtml(event.id) + "\">Schedule/Edit</button>",
      "</div>"
    ].join("");
  }

  function positionPopover(anchor, popover) {
    var rect = anchor.getBoundingClientRect();
    var popoverWidth = Math.min(360, window.innerWidth - 24);
    popover.style.width = popoverWidth + "px";
    var left = rect.right + 12;
    var top = rect.top;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - popoverWidth - 12);
    }
    if (window.innerWidth < 760) {
      left = 12;
      top = Math.min(rect.bottom + 8, window.innerHeight - 260);
    }
    popover.style.left = Math.max(12, left) + "px";
    popover.style.top = Math.max(12, Math.min(top, window.innerHeight - 260)) + "px";
  }

  function showPopover(eventId, anchor) {
    var event = eventById(eventId);
    var popover = document.getElementById("calendarEventPopover");
    if (!event || !popover || !anchor) {
      return;
    }
    window.clearTimeout(closePopoverTimer);
    activePopoverEventId = eventId;
    popover.innerHTML = popoverHtml(event);
    popover.hidden = false;
    positionPopover(anchor, popover);
  }

  function hidePopover() {
    var popover = document.getElementById("calendarEventPopover");
    activePopoverEventId = "";
    if (popover) {
      popover.hidden = true;
    }
  }

  function delayedHidePopover() {
    window.clearTimeout(closePopoverTimer);
    closePopoverTimer = window.setTimeout(hidePopover, 140);
  }

  function populateDrawer(event) {
    document.getElementById("scheduleRecordId").value = event.id;
    document.getElementById("scheduleRequestIdInput").value = event.id;
    document.getElementById("scheduleSequenceInput").value = event.sequence;
    document.getElementById("schedulePiInput").value = event.piLab;
    document.getElementById("scheduleScaleInput").value = event.scale;
    document.getElementById("scheduleTargetDateInput").value = event.targetDate;
    document.getElementById("scheduleDateInput").value = event.date;
    document.getElementById("scheduleStartTimeInput").value = event.startTime;
    document.getElementById("scheduleRuntimeInput").value = runtimeLabel(event.runtimeMinutes);
    document.getElementById("scheduleOperatorInput").value = event.operator === "Unassigned" ? "Winston Pitts" : event.operator;
    document.getElementById("scheduleInstrumentStatusInput").value = event.instrumentStatus;
    document.getElementById("schedulePriorityInput").value = event.priority;
    document.getElementById("scheduleStatusInput").value = event.status;
    document.getElementById("scheduleNotesInput").value = event.notes;
    setDrawerStatus(event.status);
    updateConflictWarning();
  }

  function setDrawerStatus(status) {
    var statusNode = document.getElementById("scheduleDrawerStatus");
    if (!statusNode) {
      return;
    }
    statusNode.className = "status-badge " + statusClass(status);
    statusNode.textContent = status;
  }

  function openScheduleDrawer(eventId) {
    var event = eventById(eventId);
    if (!event) {
      return;
    }
    selectedEventId = eventId;
    hidePopover();
    populateDrawer(event);
    document.getElementById("scheduleDrawer").classList.add("is-open");
    document.getElementById("scheduleDrawerBackdrop").classList.add("is-open");
  }

  function closeScheduleDrawer() {
    document.getElementById("scheduleDrawer").classList.remove("is-open");
    document.getElementById("scheduleDrawerBackdrop").classList.remove("is-open");
  }

  function proposedWindowFromDrawer() {
    var start = minutesFromTime(document.getElementById("scheduleStartTimeInput").value);
    var runtime = parseRuntime(document.getElementById("scheduleRuntimeInput").value);
    return {
      id: document.getElementById("scheduleRecordId").value,
      date: document.getElementById("scheduleDateInput").value,
      start: start,
      end: start + runtime
    };
  }

  function findConflicts(windowInfo) {
    if (!windowInfo.date) {
      return [];
    }
    return calendarEvents.filter(function (event) {
      if (event.id === windowInfo.id || event.date !== windowInfo.date || event.status === "Cancelled") {
        return false;
      }
      var eventStart = minutesFromTime(event.startTime);
      var eventEnd = eventStart + event.runtimeMinutes;
      return windowInfo.start < eventEnd && windowInfo.end > eventStart;
    });
  }

  function updateConflictWarning() {
    var warning = document.getElementById("scheduleConflictWarning");
    if (!warning) {
      return [];
    }
    var conflicts = findConflicts(proposedWindowFromDrawer());
    if (conflicts.length) {
      warning.hidden = false;
      warning.textContent = "Conflict warning: overlaps " + conflicts.map(function (event) {
        return event.id + " (" + timeWindow(event) + ")";
      }).join(", ") + ".";
    } else {
      warning.hidden = false;
      warning.textContent = "No local schedule conflicts detected for this time window.";
    }
    return conflicts;
  }

  function countScheduleConflicts() {
    var conflicts = 0;
    calendarEvents.forEach(function (event, index) {
      calendarEvents.slice(index + 1).forEach(function (other) {
        if (event.date !== other.date || event.status === "Cancelled" || other.status === "Cancelled") {
          return;
        }
        var start = minutesFromTime(event.startTime);
        var end = start + event.runtimeMinutes;
        var otherStart = minutesFromTime(other.startTime);
        var otherEnd = otherStart + other.runtimeMinutes;
        if (start < otherEnd && end > otherStart) {
          conflicts += 1;
        }
      });
    });
    return conflicts;
  }

  function saveSchedule(event) {
    event.preventDefault();
    var id = document.getElementById("scheduleRecordId").value;
    var row = eventById(id);
    if (!row) {
      return;
    }
    row.date = document.getElementById("scheduleDateInput").value || row.date;
    row.startTime = document.getElementById("scheduleStartTimeInput").value || row.startTime;
    row.runtimeMinutes = parseRuntime(document.getElementById("scheduleRuntimeInput").value);
    row.operator = document.getElementById("scheduleOperatorInput").value;
    row.instrumentStatus = document.getElementById("scheduleInstrumentStatusInput").value;
    row.priority = document.getElementById("schedulePriorityInput").value;
    row.status = document.getElementById("scheduleStatusInput").value;
    row.notes = document.getElementById("scheduleNotesInput").value.trim();
    setDrawerStatus(row.status);
    updateConflictWarning();
    renderAll();
    closeScheduleDrawer();
  }

  function applyFilters() {
    filterState.search = document.getElementById("calendarSearch").value;
    filterState.status = document.getElementById("calendarStatusFilter").value;
    filterState.pi = document.getElementById("calendarPiFilter").value;
    renderCalendar();
  }

  function shiftPeriod(days) {
    weekStart = addDays(weekStart, days);
    renderAll();
  }

  function bindEvents() {
    var shell = document.getElementById("calendarViewShell");
    var popover = document.getElementById("calendarEventPopover");
    var approvedBody = document.getElementById("approvedScheduleTableBody");
    var form = document.getElementById("scheduleEditForm");

    if (shell) {
      shell.addEventListener("mouseover", function (event) {
        var tile = event.target.closest(".calendar-event-tile");
        if (tile) {
          showPopover(tile.getAttribute("data-event-id"), tile);
        }
      });
      shell.addEventListener("mouseout", function (event) {
        if (event.target.closest(".calendar-event-tile")) {
          delayedHidePopover();
        }
      });
      shell.addEventListener("focusin", function (event) {
        var tile = event.target.closest(".calendar-event-tile");
        if (tile) {
          showPopover(tile.getAttribute("data-event-id"), tile);
        }
      });
      shell.addEventListener("focusout", function (event) {
        if (event.target.closest(".calendar-event-tile")) {
          delayedHidePopover();
        }
      });
      shell.addEventListener("click", function (event) {
        var scheduleButton = event.target.closest("[data-action='schedule']");
        var tile = event.target.closest(".calendar-event-tile");
        if (scheduleButton) {
          openScheduleDrawer(scheduleButton.getAttribute("data-event-id"));
        } else if (tile) {
          showPopover(tile.getAttribute("data-event-id"), tile);
        }
      });
    }

    if (popover) {
      popover.addEventListener("mouseover", function () {
        window.clearTimeout(closePopoverTimer);
      });
      popover.addEventListener("mouseout", delayedHidePopover);
      popover.addEventListener("click", function (event) {
        var button = event.target.closest("[data-action='schedule']");
        var viewButton = event.target.closest("[data-action='view']");
        if (button) {
          openScheduleDrawer(button.getAttribute("data-event-id"));
        } else if (viewButton) {
          openScheduleDrawer(viewButton.getAttribute("data-event-id"));
        }
      });
    }

    if (approvedBody) {
      approvedBody.addEventListener("click", function (event) {
        var scheduleButton = event.target.closest("[data-action='schedule']");
        var viewButton = event.target.closest("[data-action='view']");
        if (scheduleButton) {
          openScheduleDrawer(scheduleButton.getAttribute("data-event-id"));
        } else if (viewButton) {
          openScheduleDrawer(viewButton.getAttribute("data-event-id"));
        }
      });
    }

    document.getElementById("previousPeriodButton").addEventListener("click", function () {
      shiftPeriod(activeView === "month" ? -28 : -7);
    });
    document.getElementById("todayButton").addEventListener("click", function () {
      weekStart = "2026-06-22";
      renderAll();
    });
    document.getElementById("nextPeriodButton").addEventListener("click", function () {
      shiftPeriod(activeView === "month" ? 28 : 7);
    });
    document.getElementById("calendarViewSelector").addEventListener("change", function (event) {
      activeView = event.target.value;
      renderCalendar();
    });
    ["calendarSearch", "calendarStatusFilter", "calendarPiFilter"].forEach(function (id) {
      var input = document.getElementById(id);
      input.addEventListener("input", applyFilters);
      input.addEventListener("change", applyFilters);
    });
    document.getElementById("addScheduledRunButton").addEventListener("click", function () {
      openScheduleDrawer(selectedEventId);
    });
    document.getElementById("scheduleDrawerCloseButton").addEventListener("click", closeScheduleDrawer);
    document.getElementById("cancelScheduleEditButton").addEventListener("click", closeScheduleDrawer);
    document.getElementById("scheduleDrawerBackdrop").addEventListener("click", closeScheduleDrawer);
    if (form) {
      form.addEventListener("submit", saveSchedule);
    }
    ["scheduleDateInput", "scheduleStartTimeInput", "scheduleRuntimeInput", "scheduleStatusInput"].forEach(function (id) {
      var input = document.getElementById(id);
      input.addEventListener("input", updateConflictWarning);
      input.addEventListener("change", function () {
        if (id === "scheduleStatusInput") {
          setDrawerStatus(input.value);
        }
        updateConflictWarning();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hidePopover();
        closeScheduleDrawer();
      }
    });
  }

  if (!document.getElementById("calendarViewShell")) {
    return;
  }

  renderFilterOptions();
  renderAll();
  bindEvents();
})();
