// Runs before the app and stylesheet paint; kept external for the production CSP.
(function () {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('clinicos.theme');
    if (['light', 'dark', 'system'].includes(stored)) preference = stored;
  } catch {
    // Restricted browser storage must not prevent the app from loading.
  }
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0c1821' : '#f4fbfc');
})();
