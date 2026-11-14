const CONTROLS: [string[], string][] = [
  [["W", "A", "S", "D"], "Move (arrow keys also work)"],
  [["SPACE"], "Laser Cannon (hold)"],
  [["Q"], "Plasma Blast: slow, heavy, area damage"],
  [["SHIFT"], "Dash: short burst, brief invulnerability"],
  [["E"], "Code Storm: needs a full energy bar"],
  [["ESC"], "Pause"],
];

/** Keyboard reference shown before play, in the pause menu and on the landing page. */
export function ControlsList({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`grid gap-x-6 gap-y-1.5 text-left text-xs text-muted ${compact ? "" : "sm:grid-cols-2"}`}>
      {CONTROLS.map(([keys, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span className="flex shrink-0 gap-1">
            {keys.map((k) => (
              <kbd key={k} className="kbd">
                {k}
              </kbd>
            ))}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
