import type { SkillId } from "../../shared/game-rules.mjs";

type InputControllerOptions = {
  canvas: HTMLCanvasElement;
  isGameActive: () => boolean;
  isMatchFinished: () => boolean;
  isPracticeMode: () => boolean;
  onAim: (event: PointerEvent) => void;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onEscape: () => void;
  onPracticeSkill: (skill: SkillId) => void;
  onPracticeRandom: () => void;
  onTrackRandomRejected: () => void;
  onInteraction: () => void;
};

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

const SKILL_BY_KEY: Record<string, SkillId | undefined> = {
  "1": "push",
  "2": "dash",
  "3": "run",
  "4": "grab",
  "5": "clone",
  "6": "slow",
  "7": "sleep",
};

function controlKey(event: KeyboardEvent) {
  const physicalKeys: Record<string, string> = {
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d",
    KeyR: "r",
  };
  return physicalKeys[event.code] ?? event.key.toLowerCase();
}

export function installInputController(options: InputControllerOptions) {
  const pressedKeys = new Set<string>();
  const {
    canvas,
    isGameActive,
    isMatchFinished,
    isPracticeMode,
    onAim,
    onPrimaryAction,
    onSecondaryAction,
    onEscape,
    onPracticeSkill,
    onPracticeRandom,
    onTrackRandomRejected,
    onInteraction,
  } = options;

  canvas.addEventListener("pointermove", (event) => {
    if (isGameActive()) onAim(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!isGameActive() || (event.button !== 0 && event.button !== 2) || isMatchFinished()) return;
    event.preventDefault();
    onInteraction();
    onAim(event);
    if (event.button === 0) onPrimaryAction();
    else onSecondaryAction();
    canvas.focus();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    const key = controlKey(event);
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    onInteraction();
    if (key === "escape" && isGameActive()) {
      onEscape();
      return;
    }
    const selectedSkill = SKILL_BY_KEY[key];
    if (isGameActive() && isPracticeMode() && selectedSkill) {
      event.preventDefault();
      onPracticeSkill(selectedSkill);
      return;
    }
    if (isGameActive() && key === "r") {
      event.preventDefault();
      if (isPracticeMode()) onPracticeRandom();
      else onTrackRandomRejected();
      return;
    }
    if (MOVEMENT_KEYS.has(key)) {
      event.preventDefault();
      pressedKeys.add(key);
    }
  });
  window.addEventListener("keyup", (event) => pressedKeys.delete(controlKey(event)));
  window.addEventListener("blur", () => pressedKeys.clear());

  return pressedKeys;
}
