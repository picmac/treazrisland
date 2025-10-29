let bundlePromise: Promise<void> | null = null;

const DEFAULT_BUNDLE_PATH = "/vendor/emulatorjs/emulator.js";

function appendScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.body.appendChild(script);
  });
}

export function loadEmulatorBundle(src: string = DEFAULT_BUNDLE_PATH) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!bundlePromise) {
    bundlePromise = appendScript(src);
  }

  return bundlePromise;
}
