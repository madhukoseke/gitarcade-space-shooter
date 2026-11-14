"use client";

import { useFrame } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useGame } from "./GameContext";

/**
 * Fixed 2.5D camera. It only fits the arena to the viewport, follows the intro
 * rig, and applies a small damage shake (disabled with reduced effects).
 */
export function GameCamera() {
  const { engine, rig, reducedEffects } = useGame();

  useFrame(({ camera, size }) => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const t = Math.tan((cam.fov * Math.PI) / 360);
    const { halfW, halfH } = engine.arena;
    const dist = Math.max((halfH * 1.12) / t, (halfW * 1.08) / (t * aspect));
    const shake = reducedEffects ? 0 : engine.shake;
    const sx = (Math.random() - 0.5) * shake * 0.7;
    const sy = (Math.random() - 0.5) * shake * 0.7;
    cam.position.set(rig.focusX + sx, rig.focusY - dist * 0.1 * rig.zoom + sy, dist * rig.zoom);
    cam.lookAt(rig.focusX, rig.focusY, 0);
  });

  return null;
}
