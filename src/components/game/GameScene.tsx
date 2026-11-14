"use client";

import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { ContributionWeek } from "@/game/types/ContributionTypes";
import { Boss } from "./Boss";
import { EnemyFleet } from "./EnemyFleet";
import { GameCamera } from "./GameCamera";
import { useGame } from "./GameContext";
import { IntroSequence } from "./IntroSequence";
import { ParticleSystem, PowerUps, StormRing } from "./ParticleSystem";
import { PlayerShip } from "./PlayerShip";
import { ProjectileSystem } from "./ProjectileSystem";
import { SpaceEnvironment } from "./SpaceEnvironment";

/** The single place the simulation is advanced. Runs before every renderer. */
function Simulation() {
  const { engine, getInput, mode } = useGame();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const m = mode();
    if (m === "run") engine.update(dt, getInput(dt));
    else if (m === "effects") engine.tickEffects(dt);
  }, -1);
  return null;
}

export function GameScene({ weeks }: { weeks?: ContributionWeek[] }) {
  const { quality, reducedEffects } = useGame();
  const bloom = quality === "high" && !reducedEffects;
  return (
    <>
      <Simulation />
      <GameCamera />
      <SpaceEnvironment />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, -6, 10]} intensity={1.8} />
      <directionalLight position={[-6, 8, 6]} intensity={0.6} color="#6fd3ff" />
      <EnemyFleet />
      <PlayerShip />
      <ProjectileSystem />
      <PowerUps />
      <StormRing />
      <Boss />
      <ParticleSystem />
      {weeks ? <IntroSequence weeks={weeks} /> : null}
      {bloom ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.25} />
        </EffectComposer>
      ) : null}
    </>
  );
}
