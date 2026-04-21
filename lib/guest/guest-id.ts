import { readJson, writeJson } from './guest-storage';

const GUEST_PROFILE_KEY = 'guest_profile';

type GuestProfile = {
  guestId: string;
  createdAt: string;
};

let cachedGuestId: string | null = null;

function createGuestId() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `guest_${globalThis.crypto.randomUUID()}`;
  }

  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getGuestId() {
  if (cachedGuestId) {
    return cachedGuestId;
  }

  const profile = readJson<GuestProfile | null>(GUEST_PROFILE_KEY, null);

  if (profile?.guestId) {
    cachedGuestId = profile.guestId;
    return cachedGuestId;
  }

  const nextProfile: GuestProfile = {
    guestId: createGuestId(),
    createdAt: new Date().toISOString(),
  };

  writeJson(GUEST_PROFILE_KEY, nextProfile);
  cachedGuestId = nextProfile.guestId;
  return cachedGuestId;
}

export function resetGuestIdForTests() {
  cachedGuestId = null;
}

