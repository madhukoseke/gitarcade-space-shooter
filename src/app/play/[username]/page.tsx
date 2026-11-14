import { Suspense } from "react";
import Link from "next/link";
import GameClient from "@/components/game/GameClient";
import { normalizeUsername } from "@/lib/github/validation";

async function Game({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const normalized = normalizeUsername(decodeURIComponent(username));
  if (!normalized.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="panel max-w-md p-8 text-center" role="alert">
          <p className="display text-lg text-amber">Unknown pilot</p>
          <p className="mt-3 text-sm">{normalized.message}</p>
          <Link href="/" className="btn btn-primary mt-6">
            Back to title
          </Link>
        </div>
      </main>
    );
  }
  return <GameClient username={normalized.username} />;
}

export default function PlayPage({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<main className="game-root" />}>
      <Game params={params} />
    </Suspense>
  );
}
