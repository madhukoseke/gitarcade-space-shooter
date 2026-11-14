import { GamePreview } from "./GamePreview";
import { HowToPlay } from "./HowToPlay";
import { UsernameInput } from "./UsernameInput";

export function Hero() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="stars slow" aria-hidden />
      <div className="stars" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 20% 10%, rgba(57,211,83,0.10), transparent 70%), radial-gradient(55% 45% at 85% 30%, rgba(86,224,255,0.10), transparent 70%)",
        }}
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <p className="display text-sm font-black text-neon">GitArcade</p>
        <HowToPlay />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
        <div>
          <h1 className="display text-3xl font-black leading-tight text-text sm:text-5xl">
            GitHub <span className="text-neon">Space Shooter</span>
          </h1>
          <p className="display mt-4 text-xs font-bold text-cyan sm:text-sm">Your contributions. Your battlefield.</p>
        </div>

        <UsernameInput />
        <GamePreview />

        <p className="display text-[11px] font-bold text-muted">No login required to try</p>
      </main>

      <footer className="relative z-10 px-6 pb-5 text-center text-[11px] text-muted">
        Fan project, not affiliated with GitHub. Contribution-mapping ideas adapted from{" "}
        <a className="underline underline-offset-2 hover:text-text" href="https://github.com/czl9707/gh-space-shooter" rel="noreferrer noopener" target="_blank">
          czl9707/gh-space-shooter
        </a>{" "}
        (MIT).
      </footer>
    </div>
  );
}
