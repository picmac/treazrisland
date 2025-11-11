let bundlePromise: Promise<void> | null = null;

const DEFAULT_BUNDLE_PATH = "/vendor/emulatorjs/emulator.js";

function readCspNonce(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const { body } = document;
  const bodyNonce = body?.dataset?.cspNonce?.trim();
  if (bodyNonce) {
    return bodyNonce;
  }

  const meta = document.querySelector<HTMLMetaElement>("meta[name='csp-nonce']");
  const metaNonce = meta?.content?.trim();
  if (metaNonce) {
    return metaNonce;
  }

  return null;
}

function appendScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const nonce = readCspNonce();
    if (existing) {
      if (nonce && existing.nonce !== nonce) {
        existing.nonce = nonce;
      }
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    if (nonce) {
      script.nonce = nonce;
    }
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
