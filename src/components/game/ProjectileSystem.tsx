"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@/game/core/GameConfig";
import { useGame } from "./GameContext";

const BULLET_COLOR = new THREE.Color(3.2, 1.1, 0.25);
const HEAVY_COLOR = new THREE.Color(3.2, 0.3, 0.7);

/** Renders pooled projectiles with three instanced meshes. */
export function ProjectileSystem() {
  const { engine } = useGame();
  const lasers = useRef<THREE.InstancedMesh>(null);
  const plasmas = useRef<THREE.InstancedMesh>(null);
  const bullets = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const res = useMemo(() => {
    const basic = (color: THREE.ColorRepresentation | [number, number, number]) => {
      const m = new THREE.MeshBasicMaterial({ toneMapped: false });
      if (Array.isArray(color)) m.color.setRGB(color[0], color[1], color[2]);
      else m.color.set(color);
      return m;
    };
    return {
      // Tapered streak: bright head, thin tail reads as a glowing trail.
      laserGeo: new THREE.CylinderGeometry(0.085, 0.012, 1.25, 6),
      plasmaGeo: new THREE.IcosahedronGeometry(1, 1),
      bulletGeo: new THREE.OctahedronGeometry(1, 0),
      laserMat: basic([0.5, 2.3, 3.2]),
      plasmaMat: basic([3.2, 0.6, 2.8]),
      bulletMat: basic("#ffffff"),
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(res).forEach((r) => r.dispose());
    },
    [res],
  );

  useFrame(() => {
    const t = performance.now() / 1000;
    let nl = 0;
    let np = 0;
    const lm = lasers.current;
    const pm = plasmas.current;
    if (lm && pm) {
      for (const s of engine.shots) {
        if (!s.active) continue;
        if (s.kind === "plasma") {
          dummy.position.set(s.x, s.y, 0);
          dummy.rotation.set(t * 3, t * 2, 0);
          dummy.scale.setScalar(CONFIG.weapons.plasma.radius * (1 + Math.sin(t * 30) * 0.15));
          dummy.updateMatrix();
          pm.setMatrixAt(np++, dummy.matrix);
        } else {
          dummy.position.set(s.x, s.y - 0.35, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          lm.setMatrixAt(nl++, dummy.matrix);
        }
      }
      lm.count = nl;
      pm.count = np;
      lm.instanceMatrix.needsUpdate = true;
      pm.instanceMatrix.needsUpdate = true;
    }

    const bm = bullets.current;
    if (bm) {
      let nb = 0;
      for (const b of engine.bullets) {
        if (!b.active) continue;
        const heavy = b.kind === "heavy";
        dummy.position.set(b.x, b.y, 0.1);
        // Standard bullets are diamonds; heavy shots spin so they read differently.
        dummy.rotation.set(0, 0, heavy ? t * 4 : 0);
        dummy.scale.setScalar(b.radius * (heavy ? 1.25 : 1.15));
        dummy.updateMatrix();
        bm.setMatrixAt(nb, dummy.matrix);
        bm.setColorAt(nb, heavy ? HEAVY_COLOR : BULLET_COLOR);
        nb++;
      }
      bm.count = nb;
      bm.instanceMatrix.needsUpdate = true;
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={lasers} args={[res.laserGeo, res.laserMat, CONFIG.pools.shots]} frustumCulled={false} />
      <instancedMesh ref={plasmas} args={[res.plasmaGeo, res.plasmaMat, 16]} frustumCulled={false} />
      <instancedMesh ref={bullets} args={[res.bulletGeo, res.bulletMat, CONFIG.pools.bullets]} frustumCulled={false} />
    </>
  );
}
