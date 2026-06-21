(function () {
  "use strict";

  var roles = ["Admin", "Reviewer", "Requester", "Inactive"];
  var selectedUserId = "winston-pitts";
  var filterState = {
    search: "",
    role: "",
    activeOnly: false
  };

  var userRows = [
    {
      id: "winston-pitts",
      active: true,
      fullName: "Winston Pitts",
      email: "wcpitts@umich.edu",
      role: "Admin",
      labDepartment: "Hematian Lab",
      lastSignIn: "2026-06-20",
      created: "2026-06-18",
      notes: "Initial Liberty Blue administrator mock profile."
    },
    {
      id: "example-reviewer",
      active: true,
      fullName: "Example reviewer",
      email: "reviewer@example.edu",
      role: "Reviewer",
      labDepartment: "Hematian Lab",
      lastSignIn: "2026-06-19",
      created: "2026-06-18",
      notes: "Can review synthesis requests but cannot edit prices or manage users."
    },
    {
      id: "example-requester",
      active: true,
      fullName: "Example requester",
      email: "requester@example.edu",
      role: "Requester",
      labDepartment: "Outside Lab",
      lastSignIn: "2026-06-17",
      created: "2026-06-16",
      notes: "Can submit and view their own requests only; no admin dashboard access."
    },
    {
      id: "inactive-user",
      active: false,
      fullName: "Inactive user",
      email: "inactive@example.edu",
      role: "Reviewer",
      labDepartment: "Previous user",
      lastSignIn: "2026-05-30",
      created: "2026-05-02",
      notes: "Inactive users cannot access the Liberty Blue dashboard."
    }
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

  function dateLabel(value) {
    var date = new Date(value + "T12:00:00");
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function userById(id) {
    return userRows.find(function (row) {
      return row.id === id;
    });
  }

  function roleClass(row) {
    var label = row.active ? row.role : "Inactive";
    return "role-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function roleLabel(row) {
    return row.active ? row.role : "Inactive";
  }

  function getFilteredRows() {
    var search = filterState.search.trim().toLowerCase();

    return userRows.filter(function (row) {
      var matchesSearch = !search || [
        row.fullName,
        row.email,
        row.role,
        row.active ? "active" : "inactive",
        row.labDepartment,
        row.notes
      ].join(" ").toLowerCase().indexOf(search) !== -1;
      var matchesRole = !filterState.role ||
        (filterState.role === "Inactive" ? !row.active : row.active && row.role === filterState.role);
      var matchesActive = !filterState.activeOnly || row.active;

      return matchesSearch && matchesRole && matchesActive;
    });
  }

  function renderSummary() {
    var grid = document.getElementById("usersSummaryGrid");
    if (!grid) {
      return;
    }

    var activeAdmins = userRows.filter(function (row) {
      return row.active && row.role === "Admin";
    }).length;
    var reviewers = userRows.filter(function (row) {
      return row.active && row.role === "Reviewer";
    }).length;
    var requesters = userRows.filter(function (row) {
      return row.active && row.role === "Requester";
    }).length;
    var inactiveUsers = userRows.filter(function (row) {
      return !row.active;
    }).length;

    var cards = [
      { label: "Active Admins", value: activeAdmins, detail: "Full dashboard access", tone: "is-blue" },
      { label: "Reviewers", value: reviewers, detail: "Request review access", tone: "is-green" },
      { label: "Requesters", value: requesters, detail: "Own request access only", tone: "is-amber" },
      { label: "Inactive Users", value: inactiveUsers, detail: "Dashboard access disabled", tone: inactiveUsers ? "is-red" : "is-blue" }
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

  function renderRoleOptions() {
    var roleFilter = document.getElementById("userRoleFilter");
    if (!roleFilter) {
      return;
    }

    roleFilter.innerHTML = "<option value=\"\">All roles</option>" + roles.map(function (role) {
      return "<option value=\"" + escapeHtml(role) + "\">" + escapeHtml(role) + "</option>";
    }).join("");
  }

  function renderUsers() {
    var tableBody = document.getElementById("usersTableBody");
    var emptyState = document.getElementById("usersEmptyState");
    if (!tableBody) {
      return;
    }

    var rows = getFilteredRows();
    if (emptyState) {
      emptyState.hidden = rows.length > 0;
    }

    tableBody.innerHTML = rows.map(function (row) {
      var selected = row.id === selectedUserId ? " is-selected" : "";
      var inactiveRoleNote = row.active ? "" : "<br><span class=\"catalog-number\">" + escapeHtml(row.role) + " role retained</span>";
      return [
        "<tr class=\"" + selected + "\" data-user-id=\"" + escapeHtml(row.id) + "\">",
        "<td data-label=\"Active\"><span class=\"active-indicator " + (row.active ? "is-active" : "is-inactive") + "\">" + (row.active ? "Active" : "Inactive") + "</span></td>",
        "<td data-label=\"Name\"><button class=\"request-id-button\" type=\"button\" data-action=\"edit\" data-user-id=\"" + escapeHtml(row.id) + "\">" + escapeHtml(row.fullName) + "</button><br><span class=\"catalog-number\">" + escapeHtml(row.notes) + "</span></td>",
        "<td data-label=\"Email\"><a class=\"admin-text-link\" href=\"mailto:" + escapeHtml(row.email) + "\">" + escapeHtml(row.email) + "</a></td>",
        "<td data-label=\"Role\"><span class=\"role-badge " + roleClass(row) + "\">" + escapeHtml(roleLabel(row)) + "</span>" + inactiveRoleNote + "</td>",
        "<td data-label=\"Lab / Department\">" + escapeHtml(row.labDepartment) + "</td>",
        "<td data-label=\"Last Sign In\">" + escapeHtml(dateLabel(row.lastSignIn)) + "</td>",
        "<td data-label=\"Created\">" + escapeHtml(dateLabel(row.created)) + "</td>",
        "<td data-label=\"Actions\"><button class=\"admin-link-button\" type=\"button\" data-action=\"edit\" data-user-id=\"" + escapeHtml(row.id) + "\">Edit</button></td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function setDrawerStatus(active) {
    var status = document.getElementById("userDrawerActiveStatus");
    if (!status) {
      return;
    }
    status.className = "status-badge " + (active ? "status-approved" : "status-on-hold");
    status.textContent = active ? "Active" : "Inactive";
  }

  function populateDrawer(row) {
    document.getElementById("userRecordId").value = row.id;
    document.getElementById("userFullNameInput").value = row.fullName;
    document.getElementById("userEmailInput").value = row.email;
    document.getElementById("userRoleInput").value = row.role;
    document.getElementById("userLabInput").value = row.labDepartment;
    document.getElementById("userActiveInput").checked = row.active;
    document.getElementById("userNotesInput").value = row.notes;
    setDrawerStatus(row.active);
  }

  function openDrawer(id) {
    var row = userById(id);
    if (!row) {
      return;
    }
    selectedUserId = id;
    renderUsers();
    populateDrawer(row);
    document.getElementById("userDrawer").classList.add("is-open");
    document.getElementById("userDrawerBackdrop").classList.add("is-open");
  }

  function closeDrawer() {
    document.getElementById("userDrawer").classList.remove("is-open");
    document.getElementById("userDrawerBackdrop").classList.remove("is-open");
  }

  function applyFilters() {
    filterState.search = document.getElementById("userSearch").value;
    filterState.role = document.getElementById("userRoleFilter").value;
    filterState.activeOnly = document.getElementById("userActiveOnlyFilter").checked;
    renderUsers();
  }

  function clearFilters() {
    document.getElementById("userSearch").value = "";
    document.getElementById("userRoleFilter").value = "";
    document.getElementById("userActiveOnlyFilter").checked = false;
    filterState = {
      search: "",
      role: "",
      activeOnly: false
    };
    renderUsers();
  }

  function addUser() {
    var id = "mock-user-" + Date.now();
    userRows.unshift({
      id: id,
      active: true,
      fullName: "New Liberty Blue User",
      email: "new.user@example.edu",
      role: "Reviewer",
      labDepartment: "Hematian Lab",
      lastSignIn: "2026-06-20",
      created: "2026-06-20",
      notes: "Draft local user record. No Supabase invitation is sent in this mock page."
    });
    renderSummary();
    clearFilters();
    openDrawer(id);
  }

  function saveDrawer(event) {
    event.preventDefault();
    var id = document.getElementById("userRecordId").value;
    var row = userById(id);
    if (!row) {
      return;
    }

    row.fullName = document.getElementById("userFullNameInput").value.trim() || row.fullName;
    row.email = document.getElementById("userEmailInput").value.trim() || row.email;
    row.role = document.getElementById("userRoleInput").value;
    row.labDepartment = document.getElementById("userLabInput").value.trim() || row.labDepartment;
    row.active = document.getElementById("userActiveInput").checked;
    row.notes = document.getElementById("userNotesInput").value.trim();

    renderSummary();
    applyFilters();
    populateDrawer(row);
  }

  function sendInvite(event) {
    event.preventDefault();
    var email = document.getElementById("inviteEmailInput").value.trim();
    var role = document.getElementById("inviteRoleInput").value;
    var lab = document.getElementById("inviteLabInput").value.trim() || "Unassigned lab";
    var status = document.getElementById("inviteStatus");

    if (!status) {
      return;
    }
    if (!email) {
      status.textContent = "Enter an email address to preview an invitation.";
      status.classList.add("is-error");
      return;
    }
    status.classList.remove("is-error");
    status.textContent = "Mock invitation queued for " + email + " as " + role + " (" + lab + ").";
  }

  function bindEvents() {
    var tableBody = document.getElementById("usersTableBody");
    var applyButton = document.getElementById("applyUserFiltersButton");
    var clearButton = document.getElementById("clearUserFiltersButton");
    var addButton = document.getElementById("addUserButton");
    var closeButton = document.getElementById("userDrawerCloseButton");
    var cancelButton = document.getElementById("cancelUserEditButton");
    var backdrop = document.getElementById("userDrawerBackdrop");
    var form = document.getElementById("userEditForm");
    var inviteForm = document.getElementById("inviteUserForm");

    if (tableBody) {
      tableBody.addEventListener("click", function (event) {
        var button = event.target.closest("[data-action='edit']");
        var row = event.target.closest("tr[data-user-id]");
        if (button) {
          openDrawer(button.getAttribute("data-user-id"));
        } else if (row) {
          openDrawer(row.getAttribute("data-user-id"));
        }
      });
    }
    if (applyButton) {
      applyButton.addEventListener("click", applyFilters);
    }
    if (clearButton) {
      clearButton.addEventListener("click", clearFilters);
    }
    if (addButton) {
      addButton.addEventListener("click", addUser);
    }
    if (closeButton) {
      closeButton.addEventListener("click", closeDrawer);
    }
    if (cancelButton) {
      cancelButton.addEventListener("click", closeDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeDrawer);
    }
    if (form) {
      form.addEventListener("submit", saveDrawer);
    }
    if (inviteForm) {
      inviteForm.addEventListener("submit", sendInvite);
    }

    var activeInput = document.getElementById("userActiveInput");
    if (activeInput) {
      activeInput.addEventListener("change", function () {
        setDrawerStatus(activeInput.checked);
      });
    }

    ["userSearch", "userRoleFilter", "userActiveOnlyFilter"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", applyFilters);
        input.addEventListener("change", applyFilters);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    });
  }

  if (!document.getElementById("usersTableBody")) {
    return;
  }

  renderRoleOptions();
  renderSummary();
  renderUsers();
  bindEvents();
})();
