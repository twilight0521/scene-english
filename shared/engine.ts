import type {
  DialogueState,
  Task,
  InputMode,
  Session,
  Result,
  Evidence,
} from "./types";
export const RULE_VERSION = "rules-1.0.0";
export function initialDialogue(task: Task): DialogueState {
  return {
    slots: {},
    turns: 0,
    confirmed: false,
    complete: false,
    reply: task.opening,
    needsClarification: false,
    strategy: false,
  };
}
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function contains(text: string, alias: string) {
  return ` ${text} `.includes(` ${normalize(alias)} `);
}
export function advance(
  task: Task,
  previous: DialogueState,
  text: string,
  input: InputMode,
): DialogueState {
  const n = normalize(text);
  const next: DialogueState = {
    ...previous,
    slots: { ...previous.slots },
    turns: previous.turns + 1,
    needsClarification: false,
    strategy: false,
    complete: false,
    confirmed: false,
  };
  if (!n) {
    return {
      ...previous,
      reply: "I couldn’t hear that. Please try again.",
      needsClarification: true,
    };
  }
  if (n.split(" ").length > 80) {
    return {
      ...next,
      reply: "Let’s keep it short. What do you need?",
      needsClarification: true,
    };
  }
  const strategy = /\b(again|repeat|slower|slowly|slow|say that)\b/.test(n);
  let changed = false,
    conflict = false;
  for (const s of task.slots) {
    const allMatches = Object.entries(s.values)
      .flatMap(([value, aliases]) =>
        aliases
          .filter((a) => contains(n, a))
          .map((a) => ({
            value,
            alias: a,
            index: n.lastIndexOf(normalize(a)),
          })),
      )
      .sort((a, b) => a.index - b.index);
    const matches = allMatches.filter(
      (m) => !new RegExp(`\\b(?:not|no) ${normalize(m.alias)}\\b`).test(n),
    );
    if (allMatches.length && !matches.length) {
      conflict = true;
      continue;
    }
    const distinct = [...new Set(matches.map((m) => m.value))];
    if (!matches.length) continue;
    const correction =
      /\b(actually|instead|sorry|rather|no|not|make that)\b/.test(n);
    if (distinct.length > 1 && !correction) {
      conflict = true;
      continue;
    }
    const match = matches.at(-1)!;
    next.slots[s.key] = {
      value: match.value,
      source: match.alias,
      turn: next.turns,
      input,
    };
    changed = true;
  }
  if (conflict) {
    next.needsClarification = true;
    next.reply = "I heard two different choices. Which one would you like?";
    return next;
  }
  const missing = task.slots.find((s) => !next.slots[s.key]);
  const mismatched = task.slots.find(
    (s) => next.slots[s.key] && next.slots[s.key].value !== task.target[s.key],
  );
  if (strategy) {
    next.strategy = true;
    if (!task.slots.some((s) => s.key === "clarification")) {
      next.reply = previous.reply;
      return next;
    }
  }
  if (missing) {
    next.reply = task.questions[missing.key];
    next.needsClarification = !changed;
    return next;
  }
  if (mismatched) {
    next.reply = `Check your goal card. ${task.questions[mismatched.key]}`;
    return next;
  }
  const allPreviously = task.slots.every(
    (s) => previous.slots[s.key]?.value === task.target[s.key],
  );
  if (
    allPreviously &&
    !changed &&
    /\b(yes|correct|right|confirm|thanks|thank you|that's right|that is right)\b/.test(
      n,
    )
  ) {
    return {
      ...next,
      confirmed: true,
      complete: true,
      reply: "Perfect. Thank you! You did it.",
    };
  }
  next.reply = `${task.slots.map((s) => task.target[s.key].replaceAll("_", " ")).join(", ")}. Is that right?`;
  return next;
}
export function buildResult(
  s: Session,
  attempts: { phase: number; correct: boolean; input: InputMode }[],
): Result {
  const transfer = s.transfer.complete;
  const maxHelp = Math.max(
    0,
    ...s.supports.filter((h) => h.phase === "transfer").map((h) => h.level),
  );
  const expression = s.dialogue.complete;
  const userSlots = Object.values(s.transfer.slots);
  const spoken =
    transfer &&
    userSlots.length > 0 &&
    userSlots.every((e) => e.input === "voice");
  const independent = transfer && maxHelp < 4;
  return {
    comprehension: attempts.some((a) => a.phase === 1 && a.correct),
    imitation: attempts.some((a) => a.phase === 2 && a.input !== "choice"),
    expression,
    transfer,
    spoken,
    independent,
    maxHelp,
    feedback: transfer
      ? "You completed a new task. A little more real life, in English."
      : "You practised a real conversation. Keep going, one step at a time.",
    next: !spoken
      ? "Try the same task with your voice next time."
      : maxHelp >= 4
        ? "Next time, try without the example."
        : "Come back tomorrow. Try a new scene with the same idea.",
  };
}
export function scheduleReview(
  previous: number,
  success: boolean,
  now = new Date(),
) {
  const interval = success
    ? previous < 1
      ? 1
      : previous < 3
        ? 3
        : previous < 7
          ? 7
          : Math.min(30, previous * 2)
    : 1;
  const due = new Date(now);
  due.setDate(due.getDate() + interval);
  return { interval, due: due.toISOString() };
}
export function abilityStatus(evidence: Evidence[]) {
  const successes = evidence.filter(
    (e) => e.independent && e.spoken && e.kind === "transfer",
  );
  return successes.length >= 3 &&
    new Set(successes.map((e) => e.date)).size >= 2 &&
    successes.some((e) => e.novel)
    ? "independent"
    : evidence.length
      ? "practising"
      : "new";
}
