fetch("/study/Shared/nav.html")
  .then(r => r.text())
  .then(html => {
    const nav = document.querySelector("nav");
    if (!nav) return;
    nav.innerHTML = html;
  });

// ============================================================================
// Theme Management
// ============================================================================
(function() {
  const THEME_KEY = 'theme';
  const LIGHT_MODE_CLASS = 'light-mode';
  
  /**
   * Apply theme by adding/removing the light-mode class
   */
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add(LIGHT_MODE_CLASS);
    } else {
      document.body.classList.remove(LIGHT_MODE_CLASS);
    }
  }
  
  /**
   * Get saved theme from localStorage, default to 'dark'
   */
  function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }
  
  /**
   * Save theme to localStorage
   */
  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }
  
  /**
   * Get current theme based on body class
   */
  function getCurrentTheme() {
    return document.body.classList.contains(LIGHT_MODE_CLASS) ? 'light' : 'dark';
  }
  
  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    saveTheme(newTheme);
  }
  
  // Apply saved theme immediately (before page renders)
  applyTheme(getSavedTheme());
  
  // Set up event listener once DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('theme-toggle-button');
    if (toggleButton) {
      toggleButton.addEventListener('click', toggleTheme);
    }
  });
})();

// ============================================================================
// Navigation Loader (Existing)
// ============================================================================
fetch("/study/Shared/nav.html")
  .then(r => r.text())
  .then(html => {
    const nav = document.querySelector("nav");
    if (!nav) return;
    nav.innerHTML = html;
  });