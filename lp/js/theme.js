/**
 * PomoCare LP - Theme (Light / Gray / Dark)
 * Runs early in <head> to prevent flash of wrong theme.
 */
(function () {
  var theme = localStorage.getItem('pomocare-lp-theme') || 'dark';
  if (['light', 'gray', 'dark'].indexOf(theme) === -1) theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();
