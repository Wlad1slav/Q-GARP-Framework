export function readBrowserStorageItem(key: string) {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeBrowserStorageItem(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in hardened browser profiles; keep the UI running.
  }
}

export function removeBrowserStorageItem(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in hardened browser profiles; keep the UI running.
  }
}
