// ============================================================================
// Shared Navigation + UI Logic
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {

  // --------------------------------------------------------------------------
  // Inject Navigation
  // --------------------------------------------------------------------------
  fetch("/study/Shared/nav.html")
    .then(r => r.text())
    .then(html => {
      const nav = document.querySelector("header nav");
      if (nav) nav.innerHTML = html;

      applyActiveNav();
    });

  // --------------------------------------------------------------------------
  // Active Nav Highlighting
  // --------------------------------------------------------------------------
  function applyActiveNav() {
    const links = document.querySelectorAll("nav a");
    links.forEach(link => {
      if (link.pathname === location.pathname) {
        link.classList.add("active");
      }
    });
  }

  // --------------------------------------------------------------------------
  // Theme Management
  // --------------------------------------------------------------------------
  const THEME_KEY = "theme";
  const LIGHT_MODE_CLASS = "light-mode";

  function applyTheme(theme) {
    document.body.classList.toggle(LIGHT_MODE_CLASS, theme === "light");
  }

  function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains(LIGHT_MODE_CLASS);
    const newTheme = isLight ? "dark" : "light";
    applyTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  }

  applyTheme(getSavedTheme());

  const themeBtn = document.getElementById("theme-toggle-button");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // --------------------------------------------------------------------------
  // Modal Utilities
  // --------------------------------------------------------------------------
  function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.add("visible");
  }

  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove("visible");
  }

  function wireModal(buttonId, overlayId, closeId) {
    const openBtn = document.getElementById(buttonId);
    const closeBtn = document.getElementById(closeId);
    const overlay = document.getElementById(overlayId);

    if (openBtn) {
      openBtn.addEventListener("click", () => openModal(overlayId));
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => closeModal(overlayId));
    }

    if (overlay) {
      overlay.addEventListener("click", e => {
        if (e.target.classList.contains("modal-backdrop")) {
          closeModal(overlayId);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // About & Keybinds Modals
  // --------------------------------------------------------------------------
  wireModal("about-button", "about-modal-overlay", "about-modal-close");
  wireModal("keybinds-button", "keybinds-modal-overlay", "keybinds-modal-close");

});
