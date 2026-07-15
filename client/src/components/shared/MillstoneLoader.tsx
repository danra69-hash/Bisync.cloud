import type { ReactNode } from 'react';

type MillstoneSize = 'xs' | 'sm' | 'md' | 'lg';
type MillstoneLayout = 'inline' | 'block' | 'screen';

type Props = {
  size?: MillstoneSize;
  layout?: MillstoneLayout;
  label?: string;
  className?: string;
};

const SIZE_PX: Record<MillstoneSize, number> = {
  xs: 14,
  sm: 20,
  md: 36,
  lg: 48,
};

function MillstoneIcon({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bisync-millstone-spin text-primary"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.18" />
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.85" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
      <path
        d="M24 6.5v7.5M24 34v7.5M6.5 24h7.5M34 24h7.5M12.2 12.2l5.3 5.3M30.5 30.5l5.3 5.3M35.8 12.2l-5.3 5.3M17.5 30.5l-5.3 5.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MillstoneLoader({
  size = 'md',
  layout = 'block',
  label = 'Loading…',
  className = '',
}: Props) {
  const px = SIZE_PX[size];
  const icon = <MillstoneIcon px={px} />;

  if (layout === 'inline') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 text-muted-foreground ${className}`}
      >
        {icon}
        {label ? <span className="text-xs">{label}</span> : <span className="sr-only">Loading…</span>}
      </span>
    );
  }

  if (layout === 'screen') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex min-h-screen items-center justify-center bg-herme-cream ${className}`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {icon}
          <p className="text-sm font-medium text-herme-ink/60">{label || 'Loading…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground ${className}`}
    >
      {icon}
      {label ? <p className="text-sm">{label}</p> : <span className="sr-only">Loading…</span>}
    </div>
  );
}

export function TableLoadingRow({
  colSpan,
  label = 'Loading…',
  className = '',
}: {
  colSpan: number;
  label?: string;
  className?: string;
}): ReactNode {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-3 py-8 text-center ${className}`}>
        <MillstoneLoader size="sm" layout="block" label={label} className="py-2" />
      </td>
    </tr>
  );
}
