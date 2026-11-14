import type { Metadata } from "next";
import GameClient from "@/components/game/GameClient";
import { DEMO_USERNAME } from "@/lib/github/demo";

export const metadata: Metadata = {
  title: "Demo — GitArcade: Space Shooter",
  description: "Play GitArcade with simulated contribution data.",
};

/** Demo mode: same game, simulated calendar, clearly labelled as such. */
export default function DemoPage() {
  return <GameClient username={DEMO_USERNAME} demo />;
}
