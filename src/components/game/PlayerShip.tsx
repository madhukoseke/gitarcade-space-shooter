"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EMITTERS } from "@/game/systems/ShootingSystem";
import { useGame } from "./GameContext";

const HULL = "#c9d6e6";
const DARK = "#27364a";
const CYAN: [number, number, number] = [0.3, 1.9, 2.6];
const GREEN: [number, number, number] = [0.4, 2.4, 0.9];
const FLAME: [number, number, number] = [0.5, 2.2, 3.2];

/** Procedural fighter. Nose along +Y, top toward the camera (+Z). */
export function PlayerShip() {
  const { engine } = useGame();
  const group = useRef<THREE.Group>(null);
  const flameL = useRef<THREE.Group>(null);
  const flameR = useRef<THREE.Group>(null);
  const shield = useRef<THREE.Mesh>(null);
  const shieldMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = engine.player;
    const t = performance.now() / 1000;
    const blink = p.invuln > 0 && p.dashTime <= 0 && Math.floor(t * 18) % 2 === 0;
    g.visible = p.alive && !blink;
    g.position.set(p.x, p.y, 0);
    // Bank into turns and pitch slightly with vertical speed.
    g.rotation.set(0.32 + p.vy * 0.012, THREE.MathUtils.clamp(p.vx * 0.05, -0.75, 0.75), -p.vx * 0.012);

    const thrust = 0.75 + Math.max(0, p.vy) * 0.05 + (p.dashTime > 0 ? 1.2 : 0);
    const flicker = 0.85 + Math.sin(t * 60) * 0.12 + Math.sin(t * 37) * 0.08;
    const s = thrust * flicker;
    flameL.current?.scale.set(1, s, 1);
    flameR.current?.scale.set(1, s, 1);

    if (shield.current && shieldMat.current) {
      const hasShield = p.shield > 0.5 || p.shieldFlash > 0;
      shield.current.visible = hasShield && p.alive;
      shieldMat.current.opacity = (p.shield > 0.5 ? 0.035 : 0) + p.shieldFlash * 0.28;
      shield.current.position.set(p.x, p.y, 0);
      shield.current.scale.setScalar(1 + p.shieldFlash * 0.25);
    }
  });

  return (
    <>
      <group ref={group}>
        {/* Fuselage */}
        <mesh position={[0, 0.15, 0]} scale={[1, 1, 0.6]}>
          <cylinderGeometry args={[0.02, 0.28, 1.6, 8]} />
          <meshStandardMaterial color={HULL} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.55, 0]} scale={[1, 1, 0.6]}>
          <cylinderGeometry args={[0.28, 0.2, 0.3, 8]} />
          <meshStandardMaterial color={DARK} metalness={0.8} roughness={0.35} />
        </mesh>
        {/* Cockpit */}
        <mesh position={[0, 0.22, 0.13]} scale={[0.6, 1.6, 0.5]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshBasicMaterial color={CYAN} toneMapped={false} />
        </mesh>
        {/* Swept wings */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.42, -0.22, 0]} rotation={[0, 0, side * -0.42]}>
            <mesh>
              <boxGeometry args={[0.72, 0.42, 0.06]} />
              <meshStandardMaterial color={HULL} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Neon leading edge */}
            <mesh position={[0, 0.215, 0.02]}>
              <boxGeometry args={[0.72, 0.035, 0.07]} />
              <meshBasicMaterial color={GREEN} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* Tail fins */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.2, -0.55, 0.14]} rotation={[0, side * 0.5, 0]}>
            <boxGeometry args={[0.04, 0.4, 0.26]} />
            <meshStandardMaterial color={DARK} metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
        {/* Weapon emitters: positions match the projectile spawn points. */}
        <mesh position={[EMITTERS.nose.x, EMITTERS.nose.y, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshBasicMaterial color={CYAN} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * EMITTERS.wing.x, EMITTERS.wing.y - 0.25, 0]}>
            <mesh>
              <cylinderGeometry args={[0.035, 0.05, 0.5, 6]} />
              <meshStandardMaterial color={DARK} metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color={CYAN} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* Engines and animated thrusters */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.13, -0.72, 0]}>
            <mesh>
              <cylinderGeometry args={[0.09, 0.11, 0.14, 8]} />
              <meshStandardMaterial color={DARK} metalness={0.9} roughness={0.25} />
            </mesh>
            {/* Scaled from the nozzle so the flame only grows backwards. */}
            <group ref={side < 0 ? flameL : flameR} position={[0, -0.07, 0]}>
              <mesh position={[0, -0.375, 0]} rotation={[0, 0, Math.PI]}>
                <coneGeometry args={[0.085, 0.75, 8]} />
                <meshBasicMaterial color={FLAME} transparent opacity={0.85} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            </group>
          </group>
        ))}
        <pointLight color="#56e0ff" intensity={6} distance={5} position={[0, -0.9, 0.4]} />
      </group>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[0.95, 20, 14]} />
        <meshBasicMaterial ref={shieldMat} color={[0.3, 1.0, 1.5]} transparent opacity={0.035} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}
