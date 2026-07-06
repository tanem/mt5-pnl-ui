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
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-3">
        <h1 className="font-mono text-xl font-semibold tracking-tight">
          mt5<span className="text-accent">-</span>pnl-ui
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Open the{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-text">
            snapshot.json.gz.age
          </code>{" "}
          file written by mt5-pnl-exporter. It is decrypted here, in your browser
          — nothing leaves this machine.
        </p>
      </div>

      {saved && !file && (
        <button
          type="button"
          onClick={reopenSaved}
          className="rounded-md border border-border bg-surface p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
        >
          Reopen {saved.name}
        </button>
      )}
      {handleGone && (
        <p role="alert" className="text-sm text-neg">
          The saved file is no longer accessible — pick it again.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
        aria-busy={working}
      >
        <label className="flex flex-col gap-1.5 text-xs tracking-wide text-muted uppercase">
          Snapshot file
          {window.showOpenFilePicker ? (
            <button
              type="button"
              onClick={pickWithHandlePicker}
              disabled={working}
              className="rounded-md border border-border bg-surface-2 p-2.5 text-left text-sm text-text normal-case transition-colors hover:border-accent disabled:opacity-50"
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

        <label className="flex flex-col gap-1.5 text-xs tracking-wide text-muted uppercase">
          Passphrase
          <input
            ref={passRef}
            type="password"
            autoComplete="off"
            value={passphrase}
            disabled={working}
            onChange={(e) => setPassphrase(e.target.value)}
            className="text-base text-text"
          />
        </label>

        <button
          type="submit"
          disabled={working || !file || !passphrase}
          className="rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {working ? "Decrypting…" : "Unlock"}
        </button>
      </form>

      {status === "error" && error && (
        <p role="alert" className="text-sm text-neg">
          {error}
        </p>
      )}
    </main>
  );
}
