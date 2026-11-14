"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { InputManager } from "@/game/core/InputManager";

const RADIUS = 52;

function Joystick({ input }: { input: InputManager }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    input.setAxis(dx / RADIUS, -dy / RADIUS);
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.setAxis(0, 0);
  };

  return (
    <div
      className="pointer-events-auto relative h-36 w-36 touch-none rounded-full border border-line bg-white/5"
      role="application"
      aria-label="Virtual joystick: drag to move the ship"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        move(e);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) move(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-cyan bg-cyan/25"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

function HoldButton({
  label, hint, onChange, className = "",
}: { label: string; hint: string; onChange: (down: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={hint}
      className={`pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border font-bold tracking-wider active:scale-95 ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/** On-screen controls for touch devices: joystick plus action buttons. */
export function TouchControls({ input, stormReady }: { input: InputManager; stormReady: boolean }) {
  return (
    <div className="safe-pad pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between pb-4">
      <Joystick input={input} />
      <div className="grid grid-cols-2 items-end gap-2">
        <HoldButton
          label="STORM"
          hint="Code Storm special attack"
          onChange={(d) => input.setButton("special", d)}
          className={`h-14 w-14 text-[10px] ${stormReady ? "border-neon bg-neon/25 text-neon" : "border-line bg-white/5 text-muted"}`}
        />
        <HoldButton
          label="DASH"
          hint="Dash"
          onChange={(d) => input.setButton("dash", d)}
          className="h-14 w-14 border-line bg-white/5 text-[10px] text-text"
        />
        <HoldButton
          label="PLASMA"
          hint="Plasma Blast"
          onChange={(d) => input.setButton("plasma", d)}
          className="h-14 w-14 border-line bg-white/5 text-[10px] text-text"
        />
        <HoldButton
          label="FIRE"
          hint="Fire laser (hold)"
          onChange={(d) => input.setButton("fire", d)}
          className="h-20 w-20 border-cyan bg-cyan/20 text-sm text-cyan"
        />
      </div>
    </div>
  );
}
