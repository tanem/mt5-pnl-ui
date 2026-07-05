import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useApp } from "../store/app";
import {
  clearHandle,
  fileFromHandle,
  loadHandle,
  saveHandle,
} from "../lib/persist/handle";

const AGE_TYPES = [
  {
    description: "age-encrypted snapshot",
    accept: { "application/octet-stream": [".age"] as string[] },
  },
];

export default function LoadScreen() {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const load = useApp((s) => s.load);

  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [saved, setSaved] = useState<FileSystemFileHandle | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [handleGone, setHandleGone] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);
  const [prevStatus, setPrevStatus] = useState(status);

  useEffect(() => {
    void loadHandle().then(setSaved);
  }, []);

  // Clear the passphrase the moment status flips to "error" — adjusting
  // state during render (React's documented pattern for "state that depends
  // on a change in props"), rather than a setState-in-effect.
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === "error") setPassphrase("");
  }

  useEffect(() => {
    if (status === "error") passRef.current?.focus();
  }, [status]);

  async function pickWithHandlePicker() {
    if (!window.showOpenFilePicker) return;
    try {
      const [h] = await window.showOpenFilePicker({ types: AGE_TYPES });
      if (!h) return;
      setHandle(h);
      setFile(await h.getFile());
    } catch {
      // picker dismissed
    }
  }

  async function reopenSaved() {
    if (!saved) return;
    const f = await fileFromHandle(saved);
    if (f) {
      setHandle(saved);
      setFile(f);
      setHandleGone(false);
    } else {
      await clearHandle();
      setSaved(null);
      setHandleGone(true);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setHandle(null);
      setFile(dropped);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !passphrase) return;
    const ok = await load(await file.arrayBuffer(), passphrase, file.name);
    if (ok && handle) await saveHandle(handle);
  }

  const working = status === "working";

  return (
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <h1 className="text-xl font-semibold">mt5-pnl-ui</h1>
      <p>
        Open the <code>snapshot.json.gz.age</code> file written by
        mt5-pnl-exporter. It is decrypted here, in your browser — nothing
        leaves this machine.
      </p>

      {saved && !file && (
        <button type="button" onClick={reopenSaved} className="border p-2">
          Reopen {saved.name}
        </button>
      )}
      {handleGone && (
        <p role="alert">
          The saved file is no longer accessible — pick it again.
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-busy={working}>
        <label className="flex flex-col gap-1">
          Snapshot file
          {window.showOpenFilePicker ? (
            <button
              type="button"
              onClick={pickWithHandlePicker}
              disabled={working}
              className="border p-2 text-left"
            >
              {file ? file.name : "Choose file…"}
            </button>
          ) : (
            <input
              type="file"
              accept=".age"
              disabled={working}
              onChange={(e) => {
                setHandle(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          )}
        </label>

        <label className="flex flex-col gap-1">
          Passphrase
          <input
            ref={passRef}
            type="password"
            autoComplete="off"
            value={passphrase}
            disabled={working}
            onChange={(e) => setPassphrase(e.target.value)}
            className="border p-2"
          />
        </label>

        <button
          type="submit"
          disabled={working || !file || !passphrase}
          className="border p-2"
        >
          {working ? "Decrypting…" : "Unlock"}
        </button>
      </form>

      {status === "error" && error && <p role="alert">{error}</p>}
    </main>
  );
}
