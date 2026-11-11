"use client";

/**
 * Browser-only saved items (localStorage). Nothing is sent to a server or cloud.
 * Every read/write is wrapped so private browsing or blocked storage never breaks the page.
 */

export interface Saved<T> {
  id: string;
  name: string;
  savedAt: string;
  data: T;
}

function read<T>(key: string): Saved<T>[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Saved<T>[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: Saved<T>[]): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function listSaved<T>(key: string): Saved<T>[] {
  return read<T>(key).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Insert or update by id. Returns false if the browser blocked storage. */
export function upsertSaved<T>(key: string, item: Saved<T>): boolean {
  const items = read<T>(key).filter((i) => i.id !== item.id);
  items.push(item);
  return write(key, items);
}

export function deleteSaved(key: string, id: string): boolean {
  return write(key, read(key).filter((i) => i.id !== id));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
