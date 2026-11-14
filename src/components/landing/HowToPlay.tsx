"use client";

import { useRef } from "react";
import { ControlsList } from "@/components/ui/ControlsList";

const ENEMIES: [string, string, string][] = [
  ["Level 1", "Basic Drone", "100 pts · slow, simple shots"],
  ["Level 2", "Scout Fighter", "200 pts · aimed shots, dives at you"],
  ["Level 3", "Armored Fighter", "350 pts · tough, heavy shots"],
  ["Level 4", "Elite Fighter", "500 pts · spreads, twin shots, dives"],
];

export function HowToPlay() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="display text-xs font-bold text-muted hover:text-text" onClick={() => dialog.current?.showModal()}>
        How to play
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="how-title"
        className="panel m-auto w-[min(92vw,36rem)] p-6 text-text backdrop:bg-black/70"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <h2 id="how-title" className="display text-lg font-black text-neon">
          How to play
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Your GitHub contribution calendar becomes the enemy fleet. Every active day is one ship, placed where its
          square sits on the graph. The year is split into four-week sectors; clear them all to face the boss,{" "}
          <span className="text-text">Merge Conflict</span>.
        </p>
        <h3 className="display mt-5 text-xs font-bold text-cyan">Controls</h3>
        <div className="mt-2">
          <ControlsList />
        </div>
        <h3 className="display mt-5 text-xs font-bold text-cyan">Enemies</h3>
        <ul className="mt-2 grid gap-1 text-xs text-muted">
          {ENEMIES.map(([level, name, note]) => (
            <li key={name}>
              <span className="text-text">{name}</span> ({level}) · {note}
            </li>
          ))}
        </ul>
        <h3 className="display mt-5 text-xs font-bold text-cyan">Rules</h3>
        <ul className="mt-2 grid list-disc gap-1 pl-4 text-xs text-muted">
          <li>Shield absorbs damage first, then hull. Lose all hull and you spend one of three lives.</li>
          <li>Chain kills quickly to raise the combo multiplier (up to ×8). Getting hit halves it.</li>
          <li>Power-ups: Rapid Fire (chevrons), Shield Recharge (ring), Double Laser (twin bars).</li>
          <li>Kills charge Code Storm. At 100% it damages every nearby enemy and clears bullets.</li>
        </ul>
        <div className="mt-6 text-right">
          <button type="button" className="btn" onClick={() => dialog.current?.close()} autoFocus>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
