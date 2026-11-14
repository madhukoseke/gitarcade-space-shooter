"use client";

import type { ContributionProfile } from "@/game/types/ContributionTypes";
import { ControlsList } from "./ControlsList";

interface BriefingProps {
  profile: ContributionProfile;
  sectorCount: number;
  running: boolean;
  touch: boolean;
  onLaunch: () => void;
  onSkip: () => void;
}

/** Pre-flight panel shown over the floating contribution graph. */
export function Briefing({ profile, sectorCount, running, touch, onLaunch, onSkip }: BriefingProps) {
  if (running) {
    return (
      <div className="safe-pad absolute inset-x-0 bottom-0 z-20 flex justify-center pb-8">
        <button type="button" className="btn pointer-events-auto" onClick={onSkip}>
          Skip intro
        </button>
      </div>
    );
  }
  const { calendar, totalContributions } = profile;
  return (
    <div className="safe-pad absolute inset-x-0 bottom-0 z-20 flex justify-center">
      <section className="panel pop-in mb-2 w-full max-w-2xl p-5 sm:p-6" aria-labelledby="briefing-title">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar; no image optimisation config needed
            <img src={profile.avatarUrl} alt="" width={52} height={52} className="h-13 w-13 rounded-full border border-line" referrerPolicy="no-referrer" />
          ) : (
            <div className="display flex h-13 w-13 items-center justify-center rounded-full border border-line text-neon" aria-hidden>
              {profile.username.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 id="briefing-title" className="display truncate text-base text-text">
              @{profile.username}
            </h1>
            <p className="truncate text-xs text-muted">
              {profile.displayName ? `${profile.displayName} · ` : ""}
              {totalContributions.toLocaleString("en-US")} contributions · {calendar.startDate} → {calendar.endDate}
            </p>
          </div>
          {profile.simulated ? (
            <span className="ml-auto shrink-0 rounded border border-amber px-2 py-1 text-[10px] font-bold tracking-widest text-amber">
              SIMULATED DATA
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Each square above is one day. Active days become enemy ships: brighter squares are tougher classes. The
          calendar is split into <span className="text-text">{sectorCount} sectors</span> of four weeks, then a boss.
          {totalContributions === 0 ? " No activity was found in this range, so every sector is a generated patrol." : ""}
          {profile.simulated ? "" : " GitHub's calendar counts qualifying activity; it is not a record of everything you've built."}
        </p>

        {touch ? (
          <p className="mt-4 text-xs text-muted">
            Left thumb: move. Right side: <span className="text-text">FIRE</span>, <span className="text-text">PLASMA</span>,{" "}
            <span className="text-text">DASH</span> and <span className="text-text">STORM</span>.
          </p>
        ) : (
          <div className="mt-4">
            <ControlsList />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">3 lives · shield absorbs damage first</p>
          <button type="button" className="btn btn-primary pointer-events-auto" onClick={onLaunch} autoFocus>
            Launch
          </button>
        </div>
      </section>
    </div>
  );
}
