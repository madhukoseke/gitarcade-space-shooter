"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PowerUpType } from "@/game/types/ContributionTypes";
import { useGame } from "./GameContext";
import { buildPowerUpGeometry } from "./geometry";

/** Pooled particles drawn as one additive instanced mesh. */
export function ParticleSystem() {
  const { engine } = useGame();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const res = useMemo(
    () => ({
      geo: new THREE.OctahedronGeometry(1, 0),
      mat: new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    for (const q of engine.particles) {
      if (!q.active) continue;
      const k = q.life / q.maxLife;
      dummy.position.set(q.x, q.y, q.z);
      dummy.rotation.set(q.life * 6, q.life * 4, 0);
      dummy.scale.setScalar(q.size * (0.25 + k * 0.75));
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      const glow = 0.4 + k * 1.8;
      color.setRGB(q.r * glow, q.g * glow, q.b * glow);
      m.setColorAt(n, color);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, engine.particles.length]} frustumCulled={false} />;
}

const POWER_TYPES: PowerUpType[] = ["rapid", "shield", "double"];
const POWER_COLORS: Record<PowerUpType, [number, number, number]> = {
  rapid: [3, 2.3, 0.4],
  shield: [0.5, 1.7, 3.2],
  double: [2.8, 0.7, 3.2],
};

/** Falling power-ups. Each type has its own shape as well as its own colour. */
export function PowerUps() {
  const { engine } = useGame();
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geos = useMemo(() => POWER_TYPES.map(buildPowerUpGeometry), []);
  const mats = useMemo(
    () =>
      POWER_TYPES.map((t) => {
        const m = new THREE.MeshBasicMaterial({ toneMapped: false });
        m.color.setRGB(...POWER_COLORS[t]);
        return m;
      }),
    [],
  );

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
    [geos, mats],
  );

  useFrame(() => {
    engine.powerUps.forEach((u, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.visible = u.active;
      if (!u.active) return;
      const ti = POWER_TYPES.indexOf(u.type);
      m.geometry = geos[ti];
      m.material = mats[ti];
      m.position.set(u.x, u.y, 0.2);
      m.rotation.set(0.3, u.t * 2.4, 0);
      m.scale.setScalar(1.25 + Math.sin(u.t * 6) * 0.12);
    });
  });

  return (
    <>
      {engine.powerUps.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          visible={false}
          geometry={geos[0]}
          material={mats[0]}
        />
      ))}
    </>
  );
}

/** Expanding ring for the Code Storm special attack. */
export function StormRing() {
  const { engine } = useGame();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const s = engine.storm;
    m.visible = s.active;
    if (!s.active) return;
    const k = Math.min(1, s.t / 0.7);
    const eased = 1 - (1 - k) * (1 - k);
    m.position.set(s.x, s.y, 0.05);
    m.scale.setScalar(Math.max(0.01, eased * 9.5));
    mat.current.opacity = 1 - k;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <ringGeometry args={[0.9, 1, 72]} />
      <meshBasicMaterial ref={mat} color={[0.5, 3, 2]} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}
