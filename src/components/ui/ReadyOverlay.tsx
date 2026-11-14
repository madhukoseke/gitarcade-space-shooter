"use client";

import { useEffect, useState } from "react";
import { audio } from "@/lib/audio/AudioManager";
import { prefersReducedMotion } from "@/stores/settingsStore";

const STEPS = [
  { text: "", duration: 900 },
  { text: "READY?", duration: 800 },
  { text: "GO!", duration: 500 },
];

/** "SECTOR 01 / READY? / GO!" countdown, then hands control to the player. */
export function ReadyOverlay({ sectorLabel, onDone }: { sectorLabel: string; onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      const id = window.setTimeout(onDone, 1200);
      return () => window.clearTimeout(id);
    }
    if (step >= STEPS.length) {
      onDone();
      return;
    }
    audio.play(step === 2 ? "go" : "ready");
    const id = window.setTimeout(() => setStep((s) => s + 1), STEPS[step].duration);
    return () => window.clearTimeout(id);
  }, [step, onDone]);

  const text = step === 0 ? sectorLabel : (STEPS[Math.min(step, STEPS.length - 1)]?.text ?? "");
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" role="status" aria-live="assertive">
      <p key={step} className={`display pop-in hud-text text-4xl font-black sm:text-6xl ${step === 2 ? "text-neon" : "text-text"}`}>
        {text}
      </p>
    </div>
  );
}
