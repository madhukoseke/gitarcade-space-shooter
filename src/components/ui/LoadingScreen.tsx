"use client";

import Link from "next/link";
import type { LoadError } from "@/stores/gameStore";

export function LoadingScreen({ username, generating }: { username: string; generating: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto mb-6 h-10 w-10 rounded-full border-2 border-line border-t-neon motion-safe:animate-spin" aria-hidden />
        <p className="display text-sm text-cyan">{generating ? "Generating sectors" : "Scanning contribution calendar"}</p>
        <p className="mt-2 text-xs text-muted">@{username}</p>
      </div>
    </div>
  );
}

export function LoadErrorScreen({ error, username }: { error: LoadError; username: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8 text-center" role="alert">
        <p className="display text-lg text-amber">Signal lost</p>
        <p className="mt-3 text-sm text-text">{error.message}</p>
        <p className="mt-1 text-xs text-muted">Requested pilot: @{username}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn">
            Try another name
          </Link>
          <Link href="/demo" className="btn btn-primary">
            Play demo
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-muted">The demo uses simulated data, not a real GitHub profile.</p>
      </div>
    </div>
  );
}
