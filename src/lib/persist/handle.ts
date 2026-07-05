import { del, get, set } from "idb-keyval";

const KEY = "snapshot-file-handle";

/** Persist the picked handle so the next visit can offer one-click reopen. */
export async function saveHandle(h: FileSystemFileHandle): Promise<void> {
  try {
    await set(KEY, h);
  } catch {
    // IndexedDB unavailable (private mode) — reopen just won't be offered.
  }
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    return (await get<FileSystemFileHandle>(KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearHandle(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // ignore
  }
}

/** Re-request read permission if needed; null when denied or unreadable. */
export async function fileFromHandle(
  h: FileSystemFileHandle,
): Promise<File | null> {
  try {
    let perm = await h.queryPermission({ mode: "read" });
    if (perm === "prompt") perm = await h.requestPermission({ mode: "read" });
    if (perm !== "granted") return null;
    return await h.getFile();
  } catch {
    return null;
  }
}
