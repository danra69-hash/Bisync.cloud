import type { Bisync101Step } from './types';

const VOICE_PREF_KEY = 'bisync101.voiceover.enabled';

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

export function cancelBisync101Speech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Speak a step narration via the browser Speech Synthesis API. */
export function speakBisync101Step(step: Bisync101Step | undefined | null, enabled: boolean): void {
  cancelBisync101Speech();
  if (!enabled) return;
  const text = bisync101StepVoiceText(step);
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /en(-|_)?(US|GB|AU|SG)?/i.test(v.lang) && /female|samantha|google uk|google us/i.test(v.name))
      ?? voices.find(v => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  } catch {
    /* Speech API unavailable */
  }
}
