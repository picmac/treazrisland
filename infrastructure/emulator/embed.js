(() => {
  const createLoaderUrl = () => {
    const currentScript = document.currentScript;
    const scriptSrc = currentScript?.src ?? `${location.origin}${location.pathname}`;
    const baseUrl = scriptSrc.endsWith('/') ? scriptSrc : scriptSrc.replace(/[^/]+$/, '');
    return new URL('data/loader.js', baseUrl).href;
  };

  const loaderScript = document.createElement('script');
  loaderScript.src = createLoaderUrl();
  loaderScript.async = true;
  loaderScript.addEventListener('error', () => {
    console.error(`Failed to load EmulatorJS loader script from ${loaderScript.src}`);
  });
  document.head.appendChild(loaderScript);
})();
