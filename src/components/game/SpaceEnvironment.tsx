"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/game/generation/SeedGenerator";
import { useGame } from "./GameContext";
import { createGlowTexture } from "./geometry";

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uRange;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * aSpeed + uRange * 0.5, uRange) - uRange * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (60.0 / -mv.z);
    vAlpha = 0.35 + 0.65 * fract(aSize * 7.31);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(0.82, 0.92, 1.0, a);
  }
`;

const NEBULAE = [
  { color: "rgba(26,160,110,0.55)", x: -22, y: 12, z: -60, scale: 60 },
  { color: "rgba(90,50,190,0.5)", x: 26, y: -6, z: -70, scale: 75 },
  { color: "rgba(20,110,190,0.45)", x: 2, y: 26, z: -80, scale: 70 },
];

/** Procedural starfield and nebula. One draw call for all stars. */
export function SpaceEnvironment() {
  const { quality, reducedEffects } = useGame();
  const count = quality === "high" ? 1400 : 600;
  const range = 90;

  const geometry = useMemo(() => {
    const rng = mulberry32(1337);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const depth = rng();
      positions[i * 3] = (rng() - 0.5) * 150;
      positions[i * 3 + 1] = (rng() - 0.5) * range;
      positions[i * 3 + 2] = -8 - depth * 70;
      sizes[i] = 0.6 + rng() * 1.6;
      speeds[i] = 0.6 + (1 - depth) * 2.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRange: { value: range }, uPixelRatio: { value: 1 } }),
    [],
  );
  const starMaterial = useRef<THREE.ShaderMaterial>(null);

  const textures = useMemo(() => NEBULAE.map((n) => createGlowTexture(n.color)), []);
  const nebulaRef = useRef<THREE.Group>(null);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose());
    },
    [textures],
  );

  useFrame((state, delta) => {
    const u = starMaterial.current?.uniforms;
    if (!u) return;
    u.uTime.value += reducedEffects ? delta * 0.25 : delta;
    u.uPixelRatio.value = state.gl.getPixelRatio();
    if (nebulaRef.current && !reducedEffects) {
      nebulaRef.current.position.x = Math.sin(u.uTime.value * 0.03) * 3;
    }
  });

  return (
    <>
      <color attach="background" args={["#03050b"]} />
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={starMaterial}
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <group ref={nebulaRef}>
        {NEBULAE.map((n, i) => (
          <mesh key={i} position={[n.x, n.y, n.z]} scale={n.scale}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={textures[i]}
              transparent
              opacity={0.32}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
