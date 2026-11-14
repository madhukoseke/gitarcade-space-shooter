import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PowerUpType } from "@/game/types/ContributionTypes";
import type { EnemyType } from "@/game/types/EnemyTypes";

type V3 = [number, number, number];

/** Positions a primitive and normalises it to a non-indexed geometry for merging. */
function part(geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    ),
  );
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error("Failed to merge geometry parts");
  merged.computeVertexNormals();
  return merged;
}

/**
 * Procedural enemy hulls. Each class has a distinct silhouette so the type is
 * readable without relying on colour. Noses point toward -Y (the player).
 */
export function buildEnemyGeometry(type: EnemyType): THREE.BufferGeometry {
  switch (type) {
    case "drone":
      return merge([
        part(new THREE.OctahedronGeometry(0.34), [0, 0, 0], [0, 0, 0], [1, 1, 0.65]),
        part(new THREE.BoxGeometry(0.3, 0.1, 0.08), [-0.4, 0.02, 0]),
        part(new THREE.BoxGeometry(0.3, 0.1, 0.08), [0.4, 0.02, 0]),
      ]);
    case "scout":
      return merge([
        part(new THREE.ConeGeometry(0.24, 0.85, 4), [0, 0, 0], [0, Math.PI / 4, Math.PI], [1, 1, 0.6]),
        part(new THREE.BoxGeometry(0.5, 0.09, 0.07), [-0.3, 0.22, 0], [0, 0, 0.6]),
        part(new THREE.BoxGeometry(0.5, 0.09, 0.07), [0.3, 0.22, 0], [0, 0, -0.6]),
      ]);
    case "armored":
      return merge([
        part(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 6), [0, 0, 0], [Math.PI / 2, 0, 0]),
        part(new THREE.BoxGeometry(1.15, 0.2, 0.2), [0, 0.12, 0]),
        part(new THREE.BoxGeometry(0.22, 0.34, 0.24), [-0.52, -0.05, 0]),
        part(new THREE.BoxGeometry(0.22, 0.34, 0.24), [0.52, -0.05, 0]),
        part(new THREE.ConeGeometry(0.16, 0.3, 4), [0, -0.5, 0], [0, 0, Math.PI]),
      ]);
    case "elite":
      return merge([
        part(new THREE.ConeGeometry(0.28, 1.05, 5), [0, -0.05, 0], [0, 0, Math.PI], [1, 1, 0.7]),
        part(new THREE.BoxGeometry(0.78, 0.13, 0.08), [-0.46, 0.14, 0], [0, 0, 0.5]),
        part(new THREE.BoxGeometry(0.78, 0.13, 0.08), [0.46, 0.14, 0], [0, 0, -0.5]),
        part(new THREE.TorusGeometry(0.4, 0.045, 6, 14), [0, 0.12, 0]),
        part(new THREE.OctahedronGeometry(0.13), [0, 0.42, 0.05]),
      ]);
  }
}

/** Power-up icons: chevrons (rapid), ring (shield), twin bars (double). */
export function buildPowerUpGeometry(type: PowerUpType): THREE.BufferGeometry {
  switch (type) {
    case "rapid":
      return merge([
        part(new THREE.ConeGeometry(0.26, 0.3, 3), [0, 0.2, 0], [0, 0, 0], [1, 1, 0.4]),
        part(new THREE.ConeGeometry(0.26, 0.3, 3), [0, -0.12, 0], [0, 0, 0], [1, 1, 0.4]),
      ]);
    case "shield":
      return merge([part(new THREE.TorusGeometry(0.28, 0.09, 8, 18), [0, 0, 0])]);
    case "double":
      return merge([
        part(new THREE.BoxGeometry(0.12, 0.62, 0.12), [-0.17, 0, 0]),
        part(new THREE.BoxGeometry(0.12, 0.62, 0.12), [0.17, 0, 0]),
      ]);
  }
}

/** Soft radial-gradient texture used for the nebula clouds. */
export function createGlowTexture(inner: string, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.45, inner.replace(/[\d.]+\)$/, "0.25)"));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
