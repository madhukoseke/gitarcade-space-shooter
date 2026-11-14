"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeUsername } from "@/lib/github/validation";

/** Accepts a GitHub username or profile URL and routes to the generated game. */
export function UsernameInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = normalizeUsername(value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setBusy(true);
    router.push(`/play/${encodeURIComponent(result.username)}`);
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <label htmlFor={inputId} className="sr-only">
        GitHub username or profile URL
      </label>
      <input
        id={inputId}
        name="username"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={200}
        placeholder="Enter GitHub username"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-13 w-full rounded-md border bg-black/50 px-4 text-center text-base text-text placeholder:text-muted focus:border-cyan ${error ? "border-danger" : "border-line"}`}
      />
      <p id={errorId} role="alert" className={`min-h-5 text-center text-xs text-danger ${error ? "" : "invisible"}`}>
        {error ? `⚠ ${error}` : "."}
      </p>
      <button type="submit" className="btn btn-primary px-8" disabled={busy}>
        {busy ? "Generating…" : "Generate game"}
      </button>
      <Link href="/demo" className="text-xs text-muted underline underline-offset-4 hover:text-text">
        or play the demo with simulated data
      </Link>
    </form>
  );
}
