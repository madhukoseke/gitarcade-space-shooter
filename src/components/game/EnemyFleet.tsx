"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@/game/core/GameConfig";
import { ENEMY_TYPES, type EnemyType } from "@/game/types/EnemyTypes";
import { useGame } from "./GameContext";
import { buildEnemyGeometry } from "./geometry";

const TYPE_INDEX: Record<EnemyType, number> = { drone: 0, scout: 1, armored: 2, elite: 3 };

/** GitHub-inspired greens, one per contribution level. */
const BASE_COLORS: Record<EnemyType, THREE.Color> = {
  drone: new THREE.Color("#1f8a44"),
  scout: new THREE.Color("#27ad55"),
  armored: new THREE.Color("#39d353"),
  elite: new THREE.Color("#7dffa0"),
};
const EMISSIVE: Record<EnemyType, string> = {
  drone: "#0e4429",
  scout: "#006d32",
  armored: "#1a7f37",
  elite: "#26a641",
};
const MINION_COLOR = new THREE.Color("#ff6a8a");
const FLASH_COLOR = new THREE.Color(3, 3, 3);

/** All enemies of one class share a geometry, a material and one draw call. */
export function EnemyFleet() {
  const { engine } = useGame();
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const geometries = useMemo(() => ENEMY_TYPES.map(buildEnemyGeometry), []);
  const materials = useMemo(
    () =>
      ENEMY_TYPES.map(
        (type) =>
          new THREE.MeshStandardMaterial({
            color: "#ffffff",
            emissive: EMISSIVE[type],
            emissiveIntensity: type === "elite" ? 1.6 : 1.1,
            metalness: 0.35,
            roughness: 0.4,
          }),
      ),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const countsRef = useRef([0, 0, 0, 0]);

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
    [geometries, materials],
  );

  useFrame(() => {
    const t = performance.now() / 1000;
    const reveal = engine.fleetReveal;
    const counts = countsRef.current;
    counts[0] = counts[1] = counts[2] = counts[3] = 0;
    for (const e of engine.enemies) {
      if (!e.active) continue;
      const ti = TYPE_INDEX[e.type];
      const mesh = meshes.current[ti];
      if (!mesh) continue;
      const i = counts[ti]++;
      const bob = e.state === "IDLE" ? Math.sin(t * 1.7 + e.col * 1.3 + e.row * 0.7) * 0.05 : 0;
      dummy.position.set(e.x, e.y + bob, e.z);
      const diving = e.state === "ATTACKING";
      dummy.rotation.set(
        0.3,
        diving ? THREE.MathUtils.clamp(e.vx * 0.1, -0.8, 0.8) : Math.sin(t * 0.9 + e.row) * 0.18,
        diving ? e.vx * 0.05 : 0,
      );
      dummy.scale.setScalar(reveal * (1 + Math.max(0, e.hitFlash) * 1.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, e.hitFlash > 0 ? FLASH_COLOR : e.minion ? MINION_COLOR : BASE_COLORS[e.type]);
    }
    for (let ti = 0; ti < 4; ti++) {
      const mesh = meshes.current[ti];
      if (!mesh) continue;
      mesh.count = counts[ti];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {ENEMY_TYPES.map((type, i) => (
        <instancedMesh
          key={type}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[geometries[i], materials[i], CONFIG.pools.enemies]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
