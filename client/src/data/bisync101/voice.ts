import type { Bisync101Step } from './types';

const VOICE_PREF_KEY = 'bisync101.voiceover.enabled';

/** Prefer known female English voices; never intentionally pick a male voice. */
const FEMALE_NAME_RE =
  /samantha|karen|moira|tessa|fiona|victoria|veena|zira|susan|hazel|serena|catherine|martha|linda|heather|allison|ava|emma|jenny|natasha|google uk english female|google us english female|microsoft zira|female/i;
const MALE_NAME_RE =
  /\bmale\b|david|mark|daniel|\balex\b|fred|ralph|bruce|lee|thomas|ravi|google uk english male|google us english male|microsoft david|microsoft mark|microsoft george/i;

let speakToken = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let cachedFemaleVoice: SpeechSynthesisVoice | null = null;

/** Resolve the spoken line for a screenshot step. */
export function bisync101StepVoiceText(step: Bisync101Step | undefined | null): string {
  if (!step) return '';
  const custom = (step.voiceover ?? '').trim();
  if (custom) return custom;
  const title = (step.title ?? '').trim();
  const detail = (step.detail ?? '').trim();
  if (title && detail) return `${title}. ${detail}`;
  return title || detail;
}

export function readBisync101VoiceEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(VOICE_PREF_KEY);
    if (raw == null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

export function writeBisync101VoiceEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(VOICE_PREF_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function clearKeepAlive(): void {
  if (keepAliveTimer != null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

export function cancelBisync101Speech(): void {
  speakToken += 1;
  clearKeepAlive();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Estimate how long a line needs on screen so TTS is not cut off. */
export function estimateBisync101SpeechMs(text: string, rate = 0.92): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  const words = cleaned.split(/\s+/).filter(Boolean).length;
  // ~150 wpm at rate 1.0; pad so the last words are never clipped.
  const ms = (words / Math.max(0.5, 150 * rate)) * 60_000;
  return Math.max(2800, Math.ceil(ms) + 1200);
}

export function pickBisync101FemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const english = voices.filter(v => /^en([-_]|$)/i.test(v.lang));
  const pool = english.length ? english : voices;

  const namedFemale = pool.find(v => FEMALE_NAME_RE.test(v.name) && !MALE_NAME_RE.test(v.name));
  if (namedFemale) return namedFemale;

  const nonMaleEnglish = pool.filter(v => !MALE_NAME_RE.test(v.name));
  // Prefer local / premium sounding names when gender is unspecified.
  const preferredLocal =
    nonMaleEnglish.find(v => /samantha|karen|moira|victoria|zira/i.test(v.name))
    ?? nonMaleEnglish.find(v => /en-US/i.test(v.lang))
    ?? nonMaleEnglish.find(v => /en-GB/i.test(v.lang))
    ?? nonMaleEnglish[0];
  return preferredLocal ?? null;
}

export async function ensureBisync101VoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const syn = window.speechSynthesis;
  const existing = syn.getVoices();
  if (existing.length) return existing;
  return new Promise(resolve => {
    const finish = () => resolve(syn.getVoices());
    syn.addEventListener('voiceschanged', finish, { once: true });
    window.setTimeout(finish, 700);
  });
}

/** Split long narration so Chromium does not truncate a single utterance. */
export function splitBisync101SpeechChunks(text: string, maxChars = 160): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [cleaned];
  const chunks: string[] = [];
  let buf = '';
  for (const sentence of sentences) {
    if (!buf) {
      buf = sentence;
      continue;
    }
    if (`${buf} ${sentence}`.length <= maxChars) {
      buf = `${buf} ${sentence}`;
    } else {
      chunks.push(buf);
      buf = sentence;
    }
  }
  if (buf) chunks.push(buf);

  // Hard-split any remaining oversized chunk on commas / spaces.
  const out: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      out.push(chunk);
      continue;
    }
    let rest = chunk;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars);
      if (cut < maxChars * 0.4) cut = maxChars;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

function speakChunk(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate: number,
  token: number,
): Promise<void> {
  return new Promise(resolve => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    if (token !== speakToken) {
      resolve();
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    // Slightly higher pitch reads as consistently feminine across OS voices.
    utter.pitch = 1.12;
    utter.volume = 1;
    if (voice) utter.voice = voice;
    if (voice?.lang) utter.lang = voice.lang;
    else utter.lang = 'en-US';

    const done = () => {
      clearKeepAlive();
      resolve();
    };
    utter.onend = done;
    utter.onerror = done;

    // Chromium bug: long-running speak() can freeze / cut mid-utterance.
    clearKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (token !== speakToken) {
        clearKeepAlive();
        return;
      }
      try {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } catch {
        /* ignore */
      }
    }, 9000);

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      done();
    }
  });
}

/**
 * Speak a step narration via the browser Speech Synthesis API.
 * Always uses a female English voice when available; resolves when the full
 * script (including chunks) has finished so callers can avoid cutting off.
 */
export async function speakBisync101Step(
  step: Bisync101Step | undefined | null,
  enabled: boolean,
): Promise<void> {
  cancelBisync101Speech();
  if (!enabled) return;
  const text = bisync101StepVoiceText(step);
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

  const token = speakToken;
  const rate = 0.92;
  try {
    const voices = await ensureBisync101VoicesLoaded();
    if (token !== speakToken) return;
    cachedFemaleVoice = pickBisync101FemaleVoice(voices) ?? cachedFemaleVoice;
    const chunks = splitBisync101SpeechChunks(text);
    for (const chunk of chunks) {
      if (token !== speakToken) return;
      await speakChunk(chunk, cachedFemaleVoice, rate, token);
    }
  } catch {
    /* Speech API unavailable */
  }
}
