/** Bisync chain-link mark — two interlocking stadium links, Hermès orange, no background. */

const HERME = '#F37021';

type Props = {
  className?: string;
  /** Pixel width of the mark. Height scales with the aspect ratio. */
  size?: number;
  title?: string;
};

/**
 * Official Bisync icon: two horizontal capsule/chain links interlocked at center.
 * Transparent background — works on light or dark chrome.
 */
export function BisyncMark({ className = '', size = 36, title = 'Bisync' }: Props) {
  const height = Math.round(size * (44 / 80));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 44"
      width={size}
      height={height}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Left link — elongated C opening to the right */}
      <path
        d="M48 7H24a15 15 0 0 0 0 30h24"
        fill="none"
        stroke={HERME}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right link — elongated C opening to the left */}
      <path
        d="M32 7h24a15 15 0 0 1 0 30H32"
        fill="none"
        stroke={HERME}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Compact tile for app chrome (sidebar / tight headers). */
export function BisyncMarkTile({
  className = '',
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const box = size === 'md' ? 'h-9 w-9' : 'h-7 w-7';
  const mark = size === 'md' ? 32 : 26;
  return (
    <span className={`inline-flex ${box} items-center justify-center ${className}`}>
      <BisyncMark size={mark} />
    </span>
  );
}
