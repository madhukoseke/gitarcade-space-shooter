"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flattenCalendar } from "@/game/generation/ContributionParser";
import type { ContributionWeek } from "@/game/types/ContributionTypes";
import { audio } from "@/lib/audio/AudioManager";
import { useGameStore } from "@/stores/gameStore";
import { prefersReducedMotion } from "@/stores/settingsStore";
import { useGame } from "./GameContext";

/** GitHub's dark-theme contribution palette, level 0 to 4. */
const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"].map(
  (c) => new THREE.Color(c),
);

const APPROACH = 1.5;
const TRANSFORM = 1.8;
const REVEAL_AT = 0.82;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const clamp01 = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);

interface Cell {
  gx: number;
  gy: number;
  level: number;
  /** Enemy home position when this day becomes an enemy in sector 1. */
  tx: number;
  ty: number;
  morphs: boolean;
  delay: number;
}

/**
 * Signature intro: the contribution calendar floats in space as cubes, the
 * camera closes in, and the first sector's cubes morph into the enemy fleet.
 * One instanced mesh; no geometry is created per frame.
 */
export function IntroSequence({ weeks }: { weeks: ContributionWeek[] }) {
  const { engine, rig, reducedEffects } = useGame();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clock = useRef({ t: 0, age: 0, started: false, burst: false });

  const layout = useMemo(() => {
    const { halfW, portrait } = engine.arena;
    const size = Math.min(0.5, (halfW * 2 - 2.5) / Math.max(1, weeks.length));
    const centerY = portrait ? 3 : 1.6;
    const first = engine.sectors[0];
    const homes = new Map(first.enemies.filter((e) => !e.synthetic).map((e) => [e.date, e.position]));
    const cells: Cell[] = flattenCalendar(weeks).map((c) => {
      const home = homes.get(c.day.date);
      return {
        gx: (c.week - (weeks.length - 1) / 2) * size,
        gy: centerY + (3 - c.weekday) * size,
        level: c.day.level,
        tx: home?.x ?? 0,
        ty: home?.y ?? 0,
        morphs: !!home,
        delay: home ? ((c.week - first.weekStart) * 7 + c.weekday) / 28 * 0.25 : Math.min(0.5, c.week / weeks.length * 0.5),
      };
    });
    const sectorWeeks = Math.max(1, first.weekEnd - first.weekStart);
    const focusX = (first.weekStart + (sectorWeeks - 1) / 2 - (weeks.length - 1) / 2) * size;
    return { cells, size, focusX, focusY: centerY };
  }, [engine, weeks]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    layout.cells.forEach((c, i) => m.setColorAt(i, LEVEL_COLORS[c.level] ?? LEVEL_COLORS[0]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const store = useGameStore.getState();
    const c = clock.current;

    if (store.phase !== "INTRO") {
      // Intro finished or skipped: hand the scene back to the game.
      m.visible = false;
      if (engine.fleetReveal !== 1 || rig.zoom !== 1) {
        engine.setFleetReveal(1);
        rig.reset();
      }
      c.t = 0;
      c.started = false;
      c.burst = false;
      return;
    }

    m.visible = true;
    const dt = Math.min(delta, 0.1);
    c.age += dt;
    const running = store.introStage === "running";
    const calm = reducedEffects || prefersReducedMotion();

    if (running) {
      if (!c.started) {
        c.started = true;
        audio.play("transform");
      }
      c.t += dt;
      if (calm && c.t > 0.5) {
        store.setPhase("READY");
        return;
      }
    }

    const approach = calm ? 0 : easeInOut(clamp01(c.t / APPROACH));
    const k2 = calm ? 0 : clamp01((c.t - APPROACH) / TRANSFORM);
    const back = easeInOut(k2);
    // Camera moves toward the first sector, then pulls back as the fleet forms.
    const near = approach * (1 - back);
    rig.set(1 - 0.36 * near, layout.focusX * near, layout.focusY * near);

    const reveal = clamp01((k2 - REVEAL_AT) / (1 - REVEAL_AT));
    engine.setFleetReveal(reveal);
    const cube = layout.size * 0.82;
    const floatY = calm ? 0 : Math.sin(c.age * 0.9) * 0.08;

    layout.cells.forEach((cell, i) => {
      const appear = calm ? 1 : clamp01(c.age * 2.2 - cell.gx * 0.04 - 0.6);
      if (cell.morphs) {
        const k = easeInOut(clamp01((k2 - cell.delay) / 0.6));
        dummy.position.set(
          cell.gx + (cell.tx - cell.gx) * k,
          cell.gy + floatY * (1 - k) + (cell.ty - cell.gy) * k,
          Math.sin(k * Math.PI) * 1.6,
        );
        dummy.rotation.set(k * Math.PI * 2, k * Math.PI * 3, 0);
        dummy.scale.setScalar((cube + (0.6 - cube) * k) * appear * (1 - reveal));
      } else {
        const gone = clamp01((k2 - cell.delay) / 0.35);
        dummy.position.set(cell.gx, cell.gy + floatY, -gone * 6);
        dummy.rotation.set(gone * 2, gone * 3, 0);
        dummy.scale.setScalar(cube * appear * (1 - gone));
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;

    if (k2 >= REVEAL_AT && !c.burst) {
      c.burst = true;
      for (const cell of layout.cells) {
        if (cell.morphs) engine.spawnBurst(cell.tx, cell.ty, 6, 5, 0.3, 1, 0.5, 0.12, 0.5);
      }
    }
    if (running && k2 >= 1) store.setPhase("READY");
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, layout.cells.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
