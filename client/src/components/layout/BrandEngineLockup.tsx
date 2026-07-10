/** Shared Bisync.cloud ↔ Pasar.ai lockup — same engine, cross-platform. */

type Props = {
  className?: string;
  /** Compact for app chrome; roomier for landing. */
  size?: 'sm' | 'md';
  showBisyncWordmark?: boolean;
};

/** White + teal wordmark — best contrast on Bisync dark chrome (#2C1A0A). */
export function PasarAiLogo({ className = '', size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const textCls = size === 'sm' ? 'text-sm' : 'text-xl';
  return (
    <span
      className={`inline-flex items-baseline font-bold tracking-tight leading-none ${textCls} ${className}`}
      aria-label="Pasar.ai"
    >
      <span className="text-white">pasar</span>
      <span style={{ color: '#00B09B' }}>.ai</span>
    </span>
  );
}

function SyncArrow({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 18 : 28;
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
          className="text-white/55"
        />
        <path
          d="M19 1.5 L23.5 4.5 L19 7.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="text-[#00B09B]"
        />
        {/* Bottom: Pasar → Bisync */}
        <path
          d="M26 9.5 H6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="text-white/55"
        />
        <path
          d="M9 6.5 L4.5 9.5 L9 12.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="text-[#00B09B]"
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
 * Place after the Bisync wordmark in dark chrome headers.
 */
export function BrandEngineLockup({
  className = '',
  size = 'sm',
  showBisyncWordmark = true,
}: Props) {
  const bisyncCls = size === 'sm' ? 'text-sm' : 'text-xl';
  return (
    <div
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}
      title="Bisync.cloud and Pasar.ai share the same engine"
    >
      {showBisyncWordmark ? (
        <span className={`text-white font-bold tracking-tight leading-none ${bisyncCls} shrink-0`}>
          Bisync.cloud
        </span>
      ) : null}
      <SyncArrow size={size} />
      <PasarAiLogo size={size} className="shrink-0" />
    </div>
  );
}
