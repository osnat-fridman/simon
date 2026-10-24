import { STAGE_COUNT } from './game/engine';

export const RESULT_KEY = 'simon:last-result:v1';
const SCHEMA_VERSION = 1;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

// Accessing window.localStorage itself can throw (blocked storage), so resolve it lazily.
function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isValidScore(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= STAGE_COUNT;
}

// Missing, malformed or unreadable data is treated as "no result".
export function loadLastResult(storage: StorageLike | null = defaultStorage()): number | null {
  try {
    const raw = storage?.getItem(RESULT_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { schemaVersion, score } = parsed as Record<string, unknown>;
    return schemaVersion === SCHEMA_VERSION && isValidScore(score) ? score : null;
  } catch {
    return null;
  }
}

export function saveLastResult(
  score: number,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage || !isValidScore(score)) return false;
  try {
    storage.setItem(RESULT_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, score }));
    return true;
  } catch {
    return false;
  }
}
