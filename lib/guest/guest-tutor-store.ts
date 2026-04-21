import type { TutorRuntimeSnapshot } from '@/lib/types/tutor';
import { getGuestId } from '@/lib/guest/guest-id';
import { readJson, writeJson } from '@/lib/guest/guest-storage';

const GUEST_TUTOR_KEY = 'guest_tutor_sessions';

export interface GuestTutorRecord {
  id: string;
  guestId: string;
  createdAt: string;
  updatedAt: string;
  snapshot: TutorRuntimeSnapshot;
}

function readTutorSessions() {
  return readJson<GuestTutorRecord[]>(GUEST_TUTOR_KEY, []);
}

function writeTutorSessions(records: GuestTutorRecord[]) {
  writeJson(GUEST_TUTOR_KEY, records);
}

export function saveGuestTutorSnapshot(snapshot: TutorRuntimeSnapshot) {
  const records = readTutorSessions();
  const now = new Date().toISOString();
  const nextRecord: GuestTutorRecord = {
    id: snapshot.sessionId,
    guestId: getGuestId(),
    createdAt: records.find((record) => record.id === snapshot.sessionId)?.createdAt || now,
    updatedAt: now,
    snapshot,
  };

  writeTutorSessions([
    nextRecord,
    ...records.filter((record) => record.id !== snapshot.sessionId),
  ]);
}

export function getGuestTutorSnapshot(sessionId: string) {
  return readTutorSessions().find((record) => record.id === sessionId)?.snapshot || null;
}
