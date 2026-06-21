(function () {
  "use strict";

  var navItems = [
    { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "DB" },
    { key: "requests", label: "Synthesis Requests", href: "requests.html", icon: "SR" },
    { key: "calendar", label: "Calendar & Schedule", href: "calendar.html", icon: "CS" },
    { key: "reagents", label: "Reagents & Prices", href: "reagents.html", icon: "RP" },
    { key: "solvents", label: "Solvents & Consumables", href: "solvents.html", icon: "SC" },
    { key: "users", label: "Users & Permissions", href: "users.html", icon: "UP" },
    { key: "reports", label: "Reports & Exports", href: "reports.html", icon: "RE" },
    { key: "logs", label: "Instrument Logs", href: "logs.html", icon: "IL" },
    { key: "settings", label: "Settings", href: "settings.html", icon: "ST" }
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

  function renderSidebar() {
    var sidebar = document.querySelector("[data-admin-sidebar]");
    if (!sidebar) {
      return;
    }

    var activePage = document.body.getAttribute("data-admin-page") || "requests";
    var links = navItems.map(function (item) {
      var active = item.key === activePage || (activePage === "price-history" && item.key === "reports");
      return [
        "<a class=\"admin-nav-link" + (active ? " is-active" : "") + "\" href=\"" + item.href + "\"" + (active ? " aria-current=\"page\"" : "") + ">",
        "<span class=\"admin-nav-icon\" aria-hidden=\"true\">" + escapeHtml(item.icon) + "</span>",
        "<span>" + escapeHtml(item.label) + "</span>",
        "</a>"
      ].join("");
    }).join("");

    sidebar.innerHTML = [
      "<div class=\"admin-brand\">",
      "<span class=\"admin-brand-mark\" aria-hidden=\"true\">LB</span>",
      "<div class=\"admin-brand-text\">",
      "<strong>Liberty Blue</strong>",
      "<span>Admin Console</span>",
      "</div>",
      "</div>",
      "<nav class=\"admin-nav\" aria-label=\"Admin navigation\">",
      links,
      "</nav>",
      "<div class=\"admin-sidebar-footer\">",
      "<a class=\"admin-nav-link\" href=\"../index.html\">",
      "<span class=\"admin-nav-icon\" aria-hidden=\"true\">LC</span>",
      "<span>Calculator</span>",
      "</a>",
      "<a class=\"admin-nav-link\" href=\"login.html\" data-admin-signout>",
      "<span class=\"admin-nav-icon\" aria-hidden=\"true\">SO</span>",
      "<span>Sign Out</span>",
      "</a>",
      "</div>"
    ].join("");
  }

  function closeSidebar() {
    document.body.classList.remove("admin-sidebar-open");
  }

  function bindShell() {
    var menuButton = document.querySelector("[data-admin-menu-button]");
    var scrim = document.querySelector("[data-admin-mobile-scrim]");

    if (menuButton) {
      menuButton.addEventListener("click", function () {
        document.body.classList.toggle("admin-sidebar-open");
      });
    }

    if (scrim) {
      scrim.addEventListener("click", closeSidebar);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    document.querySelectorAll("[data-admin-signout]").forEach(function (link) {
      link.addEventListener("click", function () {
        localStorage.removeItem("libertyBlueAdminSession");
      });
    });
  }

  renderSidebar();
  bindShell();
})();
