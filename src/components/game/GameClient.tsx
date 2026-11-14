"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CONFIG } from "@/game/core/GameConfig";
import { GameEngine } from "@/game/core/GameEngine";
import { InputManager } from "@/game/core/InputManager";
import { arenaForAspect, generateWorld } from "@/game/generation/SectorGenerator";
import type { ContributionProfile } from "@/game/types/ContributionTypes";
import type { GameEvent } from "@/game/types/GameTypes";
import { audio } from "@/lib/audio/AudioManager";
import { createDemoProfile } from "@/lib/github/demo";
import { API_ERRORS } from "@/lib/github/errors";
import { profileSchema } from "@/lib/github/validation";
import { useGameStore, type LoadError } from "@/stores/gameStore";
import { resolveQuality, useSettingsStore } from "@/stores/settingsStore";
import { Briefing } from "@/components/ui/Briefing";
import { GameHUD } from "@/components/ui/GameHUD";
import { LoadErrorScreen, LoadingScreen } from "@/components/ui/LoadingScreen";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { ReadyOverlay } from "@/components/ui/ReadyOverlay";
import { GameOver, VictoryScreen } from "@/components/ui/ResultScreen";
import { TouchControls } from "@/components/ui/TouchControls";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import type { SimulationMode } from "./GameContext";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

const pad2 = (n: number) => String(n).padStart(2, "0");

class LoadFailure extends Error {
  constructor(readonly detail: LoadError) {
    super(detail.message);
  }
}

async function fetchProfile(username: string, signal: AbortSignal): Promise<ContributionProfile> {
  let response: Response;
  try {
    response = await fetch(`/api/github/contributions?username=${encodeURIComponent(username)}`, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new LoadFailure({ code: "NETWORK", message: API_ERRORS.NETWORK.message });
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    throw new LoadFailure({
      code: typeof err?.code === "string" ? err.code : "UPSTREAM",
      message: typeof err?.message === "string" ? err.message : API_ERRORS.UPSTREAM.message,
    });
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) throw new LoadFailure({ code: "MALFORMED", message: API_ERRORS.MALFORMED.message });
  return parsed.data;
}

function simulationMode(): SimulationMode {
  const phase = useGameStore.getState().phase;
  if (phase === "PLAYING" || phase === "GAME_OVER" || phase === "VICTORY") return "run";
  if (phase === "INTRO" || phase === "READY") return "effects";
  return "frozen";
}

interface GameClientProps {
  username: string;
  demo?: boolean;
}

/** Owns one play session: loading, the engine, input, audio and all overlays. */
export default function GameClient({ username, demo = false }: GameClientProps) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const profile = useGameStore((s) => s.profile);
  const error = useGameStore((s) => s.error);
  const result = useGameStore((s) => s.result);
  const introStage = useGameStore((s) => s.introStage);
  const stormReady = useGameStore((s) => (s.hud?.energy ?? 0) >= 100);
  const qualitySetting = useSettingsStore((s) => s.quality);
  const reducedEffects = useSettingsStore((s) => s.reducedEffects);
  const touch = useMediaQuery("(pointer: coarse)");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const input = useMemo(() => new InputManager(), []);
  const quality = useMemo(() => resolveQuality(qualitySetting), [qualitySetting]);

  // Load contribution data, generate the world, create the engine.
  useEffect(() => {
    const store = useGameStore.getState();
    const controller = new AbortController();
    store.resetSession();
    store.setPhase("LOADING_GITHUB");
    (async () => {
      try {
        const loaded = demo ? createDemoProfile() : await fetchProfile(username, controller.signal);
        if (controller.signal.aborted) return;
        store.setProfile(loaded);
        store.setPhase("GENERATING_WORLD");
        const arena = arenaForAspect(window.innerWidth / Math.max(1, window.innerHeight));
        const world = generateWorld(loaded.username, loaded.calendar.weeks, arena);
        const created = new GameEngine({
          sectors: world.sectors,
          arena,
          seed: world.seed,
          particleCap: resolveQuality(useSettingsStore.getState().quality) === "high" ? CONFIG.pools.particles : 260,
        });
        created.setFleetReveal(0);
        setEngine(created);
        store.setHud(created.hud());
        store.setPhase("INTRO");
      } catch (err) {
        if (controller.signal.aborted) return;
        store.setError(err instanceof LoadFailure ? err.detail : { code: "UPSTREAM", message: API_ERRORS.UPSTREAM.message });
        store.setPhase("IDLE");
      }
    })();
    return () => {
      controller.abort();
      setEngine(null);
      useGameStore.getState().resetSession();
    };
  }, [username, demo]);

  const togglePause = useCallback(() => {
    const store = useGameStore.getState();
    if (store.phase === "PLAYING") {
      if (store.setPhase("PAUSED")) audio.suspend();
    } else if (store.phase === "PAUSED") {
      if (store.setPhase("PLAYING")) audio.resume();
    }
  }, []);

  // Wire engine events to audio, banners and phase changes; sync the HUD at 10 Hz.
  useEffect(() => {
    if (!engine) return;
    const store = useGameStore.getState;
    const handle = (event: GameEvent) => {
      switch (event.type) {
        case "laser": audio.play("laser"); break;
        case "plasma": audio.play("plasma"); break;
        case "plasmaBurst": audio.play("explosion"); break;
        case "enemyHit": audio.play("hit"); break;
        case "enemyDown":
          audio.play(event.label === "elite" || event.label === "armored" ? "bigExplosion" : "explosion");
          break;
        case "playerHit":
          audio.play("playerHit");
          store().markDamage();
          break;
        case "shieldHit": audio.play("shield"); break;
        case "lifeLost":
          store().showBanner("Ship destroyed", `${event.value ?? 0} ${event.value === 1 ? "life" : "lives"} left`, "warn");
          break;
        case "powerUp": {
          audio.play("powerUp");
          const names: Record<string, string> = { rapid: "Rapid fire", shield: "Shield recharged", double: "Double laser" };
          store().showBanner(names[event.label ?? ""] ?? "Power-up", undefined, "good");
          break;
        }
        case "dash": audio.play("dash"); break;
        case "codeStorm": audio.play("storm"); break;
        case "sectorStart": {
          const index = event.value ?? 0;
          if (index === 0) break;
          const sector = engine.sectors[index];
          store().showBanner(
            `Sector ${pad2(index + 1)}`,
            sector.synthetic ? "No activity · generated patrol" : `${sector.startDate} → ${sector.endDate}`,
          );
          break;
        }
        case "sectorClear":
          audio.play("sectorClear");
          store().showBanner("Sector clear", `+${CONFIG.score.sectorClear.toLocaleString("en-US")}`, "good");
          break;
        case "bossWarning":
          audio.play("bossWarning");
          store().showBanner("Warning", "Merge Conflict detected", "warn");
          break;
        case "bossAppear": audio.play("bossAppear"); break;
        case "bossPhase":
          audio.play("bossAppear");
          store().showBanner(`Phase ${event.value}`, event.value === 2 ? "Sweeping lasers" : "Drones inbound", "warn");
          break;
        case "beamWarn": audio.play("ready"); break;
        case "beamFire": audio.play("beam"); break;
        case "bossDown": audio.play("bigExplosion"); break;
        case "victory":
          audio.play("victory");
          store().setResult(engine.result());
          store().setPhase("VICTORY");
          break;
        case "gameOver":
          audio.play("gameOver");
          store().setResult(engine.result());
          store().setPhase("GAME_OVER");
          break;
        default:
          break;
      }
    };
    const unsubscribe = engine.on(handle);
    const hudTimer = window.setInterval(() => store().setHud(engine.hud()), 100);
    // Debug handle for automated tests: dev builds, or production builds made with NEXT_PUBLIC_E2E=1.
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as { __GITARCADE__?: unknown }).__GITARCADE__ = { engine, store: useGameStore };
    }
    return () => {
      unsubscribe();
      window.clearInterval(hudTimer);
      delete (window as unknown as { __GITARCADE__?: unknown }).__GITARCADE__;
    };
  }, [engine]);

  // Keyboard input, pause on tab switch, and cleanup of listeners and audio.
  useEffect(() => {
    input.setPauseHandler(togglePause);
    input.attach();
    const pauseIfHidden = () => {
      if (document.hidden && useGameStore.getState().phase === "PLAYING") togglePause();
    };
    document.addEventListener("visibilitychange", pauseIfHidden);
    return () => {
      input.setPauseHandler(null);
      input.detach();
      document.removeEventListener("visibilitychange", pauseIfHidden);
      audio.dispose();
    };
  }, [input, togglePause]);

  useEffect(() => {
    input.setEnabled(phase === "PLAYING");
  }, [input, phase]);

  // Apply persisted audio preferences.
  useEffect(() => {
    const apply = (s: { muted: boolean; volume: number }) => {
      audio.setMuted(s.muted);
      audio.setVolume(s.volume);
    };
    apply(useSettingsStore.getState());
    return useSettingsStore.subscribe(apply);
  }, []);

  const getInput = useCallback(() => input.state, [input]);

  const launch = useCallback(() => {
    audio.init();
    useGameStore.getState().setIntroStage("running");
  }, []);

  const skipIntro = useCallback(() => {
    useGameStore.getState().setPhase("READY");
  }, []);

  const startPlaying = useCallback(() => {
    useGameStore.getState().setPhase("PLAYING");
  }, []);

  const restart = useCallback(() => {
    if (!engine) return;
    audio.init();
    audio.resume();
    engine.reset();
    engine.setFleetReveal(1);
    input.clear();
    const store = useGameStore.getState();
    store.setResult(null);
    store.setHud(engine.hud());
    store.setPhase("READY");
  }, [engine, input]);

  const quit = useCallback(() => {
    router.push("/");
  }, [router]);

  const showHud = profile && engine && (phase === "READY" || phase === "PLAYING" || phase === "PAUSED");

  return (
    <main className="game-root" data-phase={phase} data-testid="game-root">
      {engine && profile ? (
        <div className="absolute inset-0">
          <GameCanvas
            engine={engine}
            getInput={getInput}
            mode={simulationMode}
            quality={quality}
            reducedEffects={reducedEffects}
            weeks={profile.calendar.weeks}
            label={`Space shooter battlefield for ${profile.username}`}
          />
        </div>
      ) : null}

      {phase === "LOADING_GITHUB" || phase === "GENERATING_WORLD" ? (
        <LoadingScreen username={username} generating={phase === "GENERATING_WORLD"} />
      ) : null}
      {phase === "IDLE" && error ? <LoadErrorScreen error={error} username={username} /> : null}

      {phase === "INTRO" && profile && engine ? (
        <Briefing
          profile={profile}
          sectorCount={engine.sectors.length}
          running={introStage === "running"}
          touch={touch}
          onLaunch={launch}
          onSkip={skipIntro}
        />
      ) : null}

      {showHud ? (
        <GameHUD profile={profile} weeksPerSector={CONFIG.sector.weeks} reducedEffects={reducedEffects} onPause={togglePause} />
      ) : null}
      {phase === "READY" && engine ? <ReadyOverlay sectorLabel="SECTOR 01" onDone={startPlaying} /> : null}
      {touch && engine && (phase === "PLAYING" || phase === "READY") ? <TouchControls input={input} stormReady={stormReady} /> : null}

      {phase === "PAUSED" ? <PauseMenu onResume={togglePause} onRestart={restart} onQuit={quit} /> : null}
      {phase === "GAME_OVER" && result && profile ? (
        <GameOver username={profile.username} simulated={!!profile.simulated} result={result} onPlayAgain={restart} onQuit={quit} />
      ) : null}
      {phase === "VICTORY" && result && profile ? (
        <VictoryScreen username={profile.username} simulated={!!profile.simulated} result={result} onPlayAgain={restart} onQuit={quit} />
      ) : null}
    </main>
  );
}
