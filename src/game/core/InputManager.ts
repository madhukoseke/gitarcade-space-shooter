import { createInput, type InputState } from "../types/GameTypes";

type VirtualButton = "fire" | "plasma" | "dash" | "special";

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

const BUTTON_KEYS: Record<string, VirtualButton> = {
  Space: "fire",
  KeyQ: "plasma",
  KeyF: "plasma",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  KeyE: "special",
};

/**
 * Collects keyboard and touch input into one InputState that the engine reads
 * each fixed step. Owns its listeners and removes them in detach().
 */
export class InputManager {
  readonly state: InputState = createInput();
  onPause: (() => void) | null = null;
  enabled = true;

  private readonly keys = new Set<string>();
  private readonly virtual: Record<VirtualButton, boolean> = { fire: false, plasma: false, dash: false, special: false };
  private axisX = 0;
  private axisY = 0;
  private attached = false;

  setPauseHandler(handler: (() => void) | null): void {
    this.onPause = handler;
  }

  /** Enables or disables gameplay keys. Pause keys always work. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  attach(): void {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.clear();
  }

  clear(): void {
    this.keys.clear();
    this.axisX = 0;
    this.axisY = 0;
    this.virtual.fire = this.virtual.plasma = this.virtual.dash = this.virtual.special = false;
    this.refresh();
  }

  setAxis(x: number, y: number): void {
    this.axisX = x;
    this.axisY = y;
    this.refresh();
  }

  setButton(button: VirtualButton, down: boolean): void {
    this.virtual[button] = down;
    this.refresh();
  }

  private isTyping(event: KeyboardEvent): boolean {
    const el = event.target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isTyping(event)) return;
    if (event.code === "Escape" || event.code === "KeyP") {
      if (!event.repeat) this.onPause?.();
      return;
    }
    if (!this.enabled) return;
    if (event.code in MOVE_KEYS || event.code in BUTTON_KEYS) {
      // Space on a focused button must still activate it.
      const onControl = (event.target as HTMLElement | null)?.closest?.("button, a, [role='slider']");
      if (onControl && event.code === "Space") return;
      event.preventDefault();
      this.keys.add(event.code);
      this.refresh();
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (this.keys.delete(event.code)) this.refresh();
  };

  private handleBlur = (): void => {
    this.clear();
  };

  private refresh(): void {
    let x = this.axisX;
    let y = this.axisY;
    const pressed: Record<VirtualButton, boolean> = { ...this.virtual };
    for (const code of this.keys) {
      const move = MOVE_KEYS[code];
      if (move) {
        x += move[0];
        y += move[1];
      }
      const button = BUTTON_KEYS[code];
      if (button) pressed[button] = true;
    }
    const s = this.state;
    s.moveX = Math.max(-1, Math.min(1, x));
    s.moveY = Math.max(-1, Math.min(1, y));
    s.fire = pressed.fire;
    s.plasma = pressed.plasma;
    s.dash = pressed.dash;
    s.special = pressed.special;
  }
}
