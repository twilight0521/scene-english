export type SceneId = "foundation" | "cafe" | "shop" | "directions" | "friends";
export type InputMode = "text" | "voice" | "voice_confirmed" | "choice";
export interface Slot {
  key: string;
  label: string;
  values: Record<string, string[]>;
}
export interface Task {
  id: string;
  target: Record<string, string>;
  slots: Slot[];
  opening: string;
  questions: Record<string, string>;
  model: string;
  goal: string;
  zh: string;
  icons: string[];
}
export interface Lesson {
  id: string;
  scene: SceneId;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
  expressions: string[];
  concept: {
    prompt: string;
    answer: string;
    options: { value: string; label: string; icon: string }[];
  };
  task: Task;
  transfer: Task;
  version: number;
  status: "pilot" | "reviewed";
}
export interface Support {
  level: number;
  kind: string;
  at: string;
  phase: string;
}
export interface SlotEvidence {
  value: string;
  source: string;
  turn: number;
  input: InputMode;
}
export interface DialogueState {
  slots: Record<string, SlotEvidence>;
  turns: number;
  confirmed: boolean;
  complete: boolean;
  reply: string;
  needsClarification: boolean;
  strategy: boolean;
}
export interface Session {
  id: string;
  lessonId: string;
  lesson: Lesson;
  phase: number;
  conditions?: { subtitles: boolean; rate: number; goalText: boolean };
  reviewId?: string;
  dialogue: DialogueState;
  transfer: DialogueState;
  supports: Support[];
  completed: boolean;
  result?: Result;
  createdAt: string;
  updatedAt: string;
}
export interface Result {
  reviewDue?: string;
  comprehension: boolean;
  imitation: boolean;
  expression: boolean;
  transfer: boolean;
  spoken: boolean;
  independent: boolean;
  maxHelp: number;
  feedback: string;
  next: string;
}
export interface Evidence {
  id: string;
  lessonId: string;
  scene: SceneId;
  kind: string;
  date: string;
  novel: boolean;
  taskId?: string;
  independent: boolean;
  spoken: boolean;
  sessionId: string;
}
export interface Review {
  id: string;
  lessonId: string;
  due: string;
  interval: number;
  repetitions: number;
  lastSession?: string;
}
export interface Learner {
  id: string;
  name: string;
  email: string | null;
  settings: {
    immersion: "strict" | "assisted";
    subtitles: boolean;
    rate: number;
    onboarded: boolean;
    goal: string;
    level: string;
  };
}
export interface AppData {
  learner: Learner;
  lessons: Lesson[];
  sessions: Session[];
  reviews: Review[];
  evidence: Evidence[];
  asrAvailable: boolean;
  adminEnabled: boolean;
}
