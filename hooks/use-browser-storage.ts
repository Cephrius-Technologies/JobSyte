"use client";

import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type SetStateAction,
} from "react";

type BrowserStorageArea = "local" | "session";

type StoredStateOptions<T> = {
  key: string;
  defaultValue: T;
  parse: (raw: string | null) => T;
  serialize: (value: T) => string | null;
  storage?: BrowserStorageArea;
};

const STORAGE_CHANGE_EVENT = "jobsyte:browser-storage-change";

function getStorage(storage: BrowserStorageArea) {
  return storage === "session" ? window.sessionStorage : window.localStorage;
}

function emitStorageChange(key: string, storage: BrowserStorageArea) {
  window.dispatchEvent(
    new CustomEvent(STORAGE_CHANGE_EVENT, {
      detail: { key, storage },
    }),
  );
}

function subscribeToStorage(
  key: string,
  storage: BrowserStorageArea,
  onStoreChange: () => void,
) {
  const timeoutId = window.setTimeout(onStoreChange, 0);

  function handleNativeStorage(event: StorageEvent) {
    if (event.key === key) onStoreChange();
  }

  function handleSameTabStorage(event: Event) {
    const detail = (event as CustomEvent<{ key?: string; storage?: string }>).detail;
    if (detail?.key === key && detail.storage === storage) onStoreChange();
  }

  window.addEventListener("storage", handleNativeStorage);
  window.addEventListener(STORAGE_CHANGE_EVENT, handleSameTabStorage);

  return () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener("storage", handleNativeStorage);
    window.removeEventListener(STORAGE_CHANGE_EVENT, handleSameTabStorage);
  };
}

export function useBrowserStoredState<T>({
  key,
  defaultValue,
  parse,
  serialize,
  storage = "local",
}: StoredStateOptions<T>): [T, (next: SetStateAction<T>) => void] {
  const lastSnapshotRef = useRef<{
    raw: string | null;
    parse: (raw: string | null) => T;
    value: T;
  } | null>(null);

  const getClientSnapshot = useCallback(() => {
    try {
      const raw = getStorage(storage).getItem(key);
      const lastSnapshot = lastSnapshotRef.current;
      if (lastSnapshot?.raw === raw && lastSnapshot.parse === parse) {
        return lastSnapshot.value;
      }

      const value = parse(raw);
      // Cache stable snapshots so parsed arrays/objects do not re-render forever.
      lastSnapshotRef.current = { raw, parse, value };
      return value;
    } catch {
      return defaultValue;
    }
  }, [defaultValue, key, parse, storage]);

  const value = useSyncExternalStore(
    useCallback(
      (onStoreChange) => subscribeToStorage(key, storage, onStoreChange),
      [key, storage],
    ),
    getClientSnapshot,
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      const current = getClientSnapshot();
      const resolved =
        typeof next === "function" ? (next as (currentValue: T) => T)(current) : next;
      const serialized = serialize(resolved);

      try {
        if (serialized === null) {
          getStorage(storage).removeItem(key);
        } else {
          getStorage(storage).setItem(key, serialized);
        }
      } catch {
        // Ignore storage write failures; the UI will keep using the last snapshot.
      }

      emitStorageChange(key, storage);
    },
    [getClientSnapshot, key, serialize, storage],
  );

  return [value, setValue];
}
