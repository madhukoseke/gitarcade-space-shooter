"use client";

import { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/game/types/GameTypes";
import { cardToBlob, drawResultCard, formatScore, formatTime, resultText, type ShareInfo } from "@/lib/share/resultCard";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Result card preview with copy, download and native share. Client-side only. */
function SharePanel({ info }: { info: ShareInfo }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (canvasRef.current) drawResultCard(canvasRef.current, info);
  }, [info]);

  const fileName = `gitarcade-${info.username}.png`;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(resultText(info));
      setStatus("Result text copied.");
    } catch {
      setStatus("Copy was blocked by the browser. Select the text below instead.");
    }
  };

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await cardToBlob(canvasRef.current);
    if (!blob) {
      setStatus("Could not create the image.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Image downloaded.");
  };

  const nativeShare = async () => {
    if (!canvasRef.current) return;
    const text = resultText(info);
    try {
      const blob = await cardToBlob(canvasRef.current);
      const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "GitArcade: Space Shooter", text, files: [file] });
      } else {
        await navigator.share({ title: "GitArcade: Space Shooter", text });
      }
      setStatus("Shared.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setStatus("Sharing isn't available here. Use copy or download.");
    }
  };

  return (
    <div className="mt-5 border-t border-line pt-5" data-testid="share-panel">
      <canvas ref={canvasRef} className="w-full rounded border border-line" aria-label="Result card image preview" role="img" />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn" onClick={copyText}>
          Copy text
        </button>
        <button type="button" className="btn" onClick={download}>
          Download image
        </button>
        {canNativeShare ? (
          <button type="button" className="btn" onClick={nativeShare}>
            Share…
          </button>
        ) : null}
      </div>
      <p className="mt-2 min-h-4 text-center text-[11px] text-neon" role="status" aria-live="polite">
        {status}
      </p>
      <pre className="mt-1 select-text whitespace-pre-wrap rounded bg-black/40 p-2 text-left text-[10px] text-muted">{resultText(info)}</pre>
    </div>
  );
}

interface ResultProps {
  username: string;
  simulated: boolean;
  result: GameResult;
  onPlayAgain: () => void;
  onQuit: () => void;
}

function ResultScreen({ username, simulated, result, onPlayAgain, onQuit }: ResultProps) {
  const [sharing, setSharing] = useState(false);
  const title = result.victory ? "Victory" : "Game Over";
  const stats: [string, string][] = [
    ["Score", formatScore(result.score)],
    ["Sector", `${pad2(result.sectorReached)}/${pad2(result.sectorCount)}`],
    ["Enemies", String(result.kills)],
    ["Accuracy", `${Math.round(result.accuracy * 100)}%`],
    ["Highest combo", String(result.maxCombo)],
    ["Damage taken", String(result.damageTaken)],
    ["Survival time", formatTime(result.time)],
    ["Rating", result.rating],
  ];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="panel pop-in my-auto w-full max-w-md p-6 text-center" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <h2 id="result-title" className={`display text-3xl font-black ${result.victory ? "text-neon" : "text-danger"}`}>
          {title}
        </h2>
        {result.victory ? <p className="mt-1 text-xs text-muted">Merge Conflict resolved.</p> : null}
        <p className="mt-3 font-bold text-cyan">@{username}</p>
        {simulated ? <p className="text-[10px] font-bold tracking-widest text-amber">SIMULATED DATA</p> : null}

        <dl className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
          {stats.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
              <dd className="text-right font-bold tabular-nums text-text">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[10px] text-muted">
          Rating compares your score with a combo-free full clear of this calendar. Local result: not verified or ranked.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <button type="button" className="btn btn-primary" onClick={onPlayAgain} autoFocus>
            Play again
          </button>
          <button type="button" className="btn" onClick={() => setSharing((s) => !s)} aria-expanded={sharing}>
            Share result
          </button>
          <button type="button" className="btn" onClick={onQuit}>
            Quit to title
          </button>
        </div>
        {sharing ? <SharePanel info={{ username, simulated, result }} /> : null}
      </div>
    </div>
  );
}

export function GameOver(props: ResultProps) {
  return <ResultScreen {...props} />;
}

export function VictoryScreen(props: ResultProps) {
  return <ResultScreen {...props} />;
}
