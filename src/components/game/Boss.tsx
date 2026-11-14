"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@/game/core/GameConfig";
import { useGame } from "./GameContext";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  side: -1 | 0 | 1;
  phase: number;
}

/** "Ours" on the left, "theirs" on the right, conflict markers in the seam. */
function buildBlocks(): Block[] {
  const blocks: Block[] = [];
  const rows = [1.25, 0.75, 0.25, -0.25, -0.75, -1.25];
  rows.forEach((y, r) => {
    const widthL = 0.9 + ((r * 37) % 5) * 0.22;
    const widthR = 0.8 + ((r * 53) % 5) * 0.24;
    blocks.push({ x: -0.55 - widthL / 2, y, w: widthL, h: 0.36, side: -1, phase: r * 1.7 });
    blocks.push({ x: 0.55 + widthR / 2, y, w: widthR, h: 0.36, side: 1, phase: r * 2.3 + 1 });
  });
  // Conflict markers: <<<<<<<, =======, >>>>>>>
  blocks.push({ x: 0, y: 1.7, w: 2.6, h: 0.14, side: 0, phase: 0 });
  blocks.push({ x: 0, y: 0, w: 0.5, h: 0.14, side: 0, phase: 1 });
  blocks.push({ x: 0, y: -1.7, w: 2.6, h: 0.14, side: 0, phase: 2 });
  return blocks;
}

const OURS = new THREE.Color("#2ea043");
const THEIRS = new THREE.Color("#d43f6b");
const MARKER = new THREE.Color(3, 2.2, 0.3);
const WHITE = new THREE.Color(3, 3, 3);

/** Merge Conflict: a machine built from fragmented code blocks. */
export function Boss() {
  const { engine } = useGame();
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const blockRefs = useRef<(THREE.Mesh | null)[]>([]);
  const blocks = useMemo(() => buildBlocks(), []);
  const materials = useMemo(
    () =>
      blocks.map((b) =>
        b.side === 0
          ? new THREE.MeshBasicMaterial({ color: MARKER, toneMapped: false })
          : new THREE.MeshStandardMaterial({
              color: b.side < 0 ? OURS : THEIRS,
              emissive: b.side < 0 ? OURS : THEIRS,
              emissiveIntensity: 0.55,
              metalness: 0.5,
              roughness: 0.35,
            }),
      ),
    [blocks],
  );

  useFrame(() => {
    const b = engine.boss;
    const g = group.current;
    if (!g) return;
    g.visible = b.active;
    const t = performance.now() / 1000;

    if (b.active) {
      g.position.set(b.x, b.y, 0);
      g.rotation.set(0.25, Math.sin(t * 0.6) * 0.12, 0);
      const dyingK = b.dying > 0 ? 1 - b.dying / CONFIG.boss.dyingTime : 0;
      // The seam opens wider in later phases, exposing the core.
      const gap = (b.phase - 1) * 0.28 + dyingK * 3;
      const flash = b.hitFlash > 0;
      blocks.forEach((blk, i) => {
        const m = blockRefs.current[i];
        if (!m) return;
        const jitter = Math.sin(t * 2.2 + blk.phase) * 0.06 * b.phase;
        m.position.set(
          blk.x + blk.side * gap + jitter + blk.side * dyingK * Math.sin(blk.phase) * 2,
          blk.y + Math.cos(t * 1.7 + blk.phase) * 0.04 + dyingK * Math.cos(blk.phase * 3) * 2,
          Math.sin(t * 1.3 + blk.phase) * 0.12,
        );
        m.rotation.z = dyingK * blk.phase;
        const mat = materials[i];
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.copy(flash ? WHITE : blk.side < 0 ? OURS : THEIRS);
          mat.emissiveIntensity = flash ? 1 : 0.55 + Math.sin(t * 3 + blk.phase) * 0.15;
        }
      });
      if (core.current) {
        core.current.rotation.set(t * 0.8, t * 1.1, 0);
        core.current.scale.setScalar(0.5 + (b.phase - 1) * 0.12 + Math.sin(t * 6) * 0.04);
      }
    }

    const bm = beam.current;
    if (bm && beamMat.current) {
      bm.visible = b.active && b.beamState !== "off";
      if (bm.visible) {
        const height = engine.arena.halfH * 2 + 4;
        const warn = b.beamState === "warn";
        bm.position.set(b.beamX, b.y - height / 2, 0.02);
        // Warning: thin blinking line. Firing: full-width beam.
        bm.scale.set(warn ? 0.1 : CONFIG.boss.beamHalfWidth * 2, height, 1);
        beamMat.current.opacity = warn ? 0.35 + (Math.floor(t * 10) % 2) * 0.45 : 0.85;
      }
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        {blocks.map((blk, i) => (
          <mesh
            key={i}
            ref={(m) => {
              blockRefs.current[i] = m;
            }}
            material={materials[i]}
          >
            <boxGeometry args={[blk.w, blk.h, 0.4]} />
          </mesh>
        ))}
        <mesh ref={core}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={[3, 0.5, 0.9]} wireframe toneMapped={false} />
        </mesh>
        <pointLight color="#ff4d7d" intensity={30} distance={12} position={[0, 0, 2]} />
      </group>
      <mesh ref={beam} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={beamMat} color={[3.2, 0.5, 0.9]} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}
