const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

