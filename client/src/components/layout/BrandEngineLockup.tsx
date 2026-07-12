/** Shared Bisync.cloud ↔ Pasar.ai lockup — same engine, cross-platform. */

const HERME = '#F37021';

type Tone = 'onDark' | 'onLight';

type Props = {
  className?: string;
  /** Compact for app chrome; roomier for landing. */
  size?: 'sm' | 'md';
  showBisyncWordmark?: boolean;
  /**
   * onDark — white wordmark (Header / Sidebar #2C1A0A).
   * onLight — near-black wordmark (Dev Console / light cards).
   */
  tone?: Tone;
};

function wordmarkClass(tone: Tone) {
  return tone === 'onLight' ? 'text-[#2C1A0A]' : 'text-white';
}

function mutedStrokeClass(tone: Tone) {
  return tone === 'onLight' ? 'text-[#2C1A0A]/55' : 'text-white/55';
}

/** Hermes-accented .ai + contrast-aware "pasar" wordmark. */
export function PasarAiLogo({
  className = '',
  size = 'sm',
  tone = 'onDark',
}: {
  className?: string;
  size?: 'sm' | 'md';
  tone?: Tone;
}) {
  const textCls = size === 'sm' ? 'text-sm' : 'text-xl';
  return (
    <span
      className={`inline-flex items-baseline font-bold tracking-tight leading-none ${textCls} ${className}`}
      aria-label="Pasar.ai"
    >
      <span className={wordmarkClass(tone)}>pasar</span>
      <span style={{ color: HERME }}>.ai</span>
    </span>
  );
}

function SyncArrow({ size = 'sm', tone = 'onDark' }: { size?: 'sm' | 'md'; tone?: Tone }) {
  const dim = size === 'sm' ? 18 : 28;
  const muted = mutedStrokeClass(tone);
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: dim + 8, height: dim }}
      aria-hidden
    >
      <svg
        width={dim}
        height={dim * 0.55}
        viewBox="0 0 28 14"
        fill="none"
        className="brand-sync-arrow"
      >
        {/* Top: Bisync → Pasar */}
        <path
          d="M2 4.5 H22"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={muted}
        />
        <path
          d="M19 1.5 L23.5 4.5 L19 7.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="text-herme"
        />
        {/* Bottom: Pasar → Bisync */}
        <path
          d="M26 9.5 H6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={muted}
        />
        <path
          d="M9 6.5 L4.5 9.5 L9 12.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="text-herme"
        />
      </svg>
      {/* Traveling pulse dots */}
      <span className="brand-sync-dot brand-sync-dot-fwd" />
      <span className="brand-sync-dot brand-sync-dot-back" />
    </span>
  );
}

/**
 * Bisync.cloud ↔ Pasar.ai — continuous sync animation.
 * "cloud" and ".ai" use Hermes orange; use tone="onLight" on light backgrounds.
 */
export function BrandEngineLockup({
  className = '',
  size = 'sm',
  showBisyncWordmark = true,
  tone = 'onDark',
}: Props) {
  const bisyncCls = size === 'sm' ? 'text-sm' : 'text-xl';
  return (
    <div
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}
      title="Bisync.cloud and Pasar.ai share the same engine"
    >
      {showBisyncWordmark ? (
        <span className={`${wordmarkClass(tone)} font-bold tracking-tight leading-none ${bisyncCls} shrink-0`}>
          Bisync.<span style={{ color: HERME }}>cloud</span>
        </span>
      ) : null}
      <SyncArrow size={size} tone={tone} />
      <PasarAiLogo size={size} tone={tone} className="shrink-0" />
    </div>
  );
}
