/** Hotspot drawn on the animated screen-lesson canvas (0–100 percentages). */
export type Bisync101Hotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type Bisync101Step = {
  title: string;
  detail: string;
  /**
   * Narration spoken while this screenshot step plays.
   * When omitted, the player speaks `${title}. ${detail}`.
   */
  voiceover?: string;
  /** Optional start offset (ms) within a recorded clip for voice/step sync. */
  startMs?: number;
  hotspot?: Bisync101Hotspot;
};

export type Bisync101Task = {
  id: string;
  title: string;
  summary: string;
  /** Short clip length hint shown in the task list, e.g. "~25 sec". */
  durationLabel: string;
  steps: Bisync101Step[];
  tips?: string[];
  /**
   * Optional platform-screen recording under `client/public/bisync101/clips/`.
   * When present, the player prefers this file over the animated lesson.
   * Prefer clips from `scripts/capture-bisync101-clips.mjs` (live UI + cursor + typing).
   */
  clipFile?: string;
  /** Where this lives in the product nav (for orientation). */
  whereInApp?: string;
};

export type Bisync101Module = {
  id: string;
  title: string;
  blurb: string;
  /** Lucide-style key used by the workspace icon map. */
  icon:
    | 'home'
    | 'settings'
    | 'shopping-cart'
    | 'package'
    | 'factory'
    | 'warehouse'
    | 'users'
    | 'store'
    | 'calculator'
    | 'file-text';
  tasks: Bisync101Task[];
};
