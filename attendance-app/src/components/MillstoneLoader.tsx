type Props = {
  /** Full-viewport centered overlay (dimmed backdrop). */
  overlay?: boolean
  label?: string
  className?: string
}

/** Animated hand millstone shown while remote/DB data is loading. */
export function MillstoneLoader({
  overlay = false,
  label = 'Loading…',
  className = '',
}: Props) {
  const content = (
    <div
      className={`millstone-loader ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="millstone-stage">
        <div className="millstone-shadow" aria-hidden />
        <div className="millstone-dust" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <svg
          className="millstone-spinner"
          viewBox="0 0 140 140"
          width="88"
          height="88"
          aria-hidden
        >
          <defs>
            <radialGradient id="millstone-face" cx="48%" cy="42%" r="58%">
              <stop offset="0%" stopColor="#e8d7bd" />
              <stop offset="45%" stopColor="#c4a57a" />
              <stop offset="100%" stopColor="#8a6d4a" />
            </radialGradient>
            <linearGradient id="millstone-handle-wood" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d09a58" />
              <stop offset="55%" stopColor="#8b5a2b" />
              <stop offset="100%" stopColor="#5c3a1a" />
            </linearGradient>
          </defs>

          <g className="millstone-stone">
            <circle
              cx="70"
              cy="78"
              r="48"
              fill="url(#millstone-face)"
              stroke="#5c4634"
              strokeWidth="3"
            />
            <circle
              className="millstone-ring"
              cx="70"
              cy="78"
              r="42"
              fill="none"
              stroke="#6e5538"
              strokeWidth="1.1"
              opacity="0.4"
            />

            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI) / 6 - Math.PI / 2
              const x1 = 70 + Math.cos(a) * 14
              const y1 = 78 + Math.sin(a) * 14
              const x2 = 70 + Math.cos(a) * 40
              const y2 = 78 + Math.sin(a) * 40
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#5c4634"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.5"
                />
              )
            })}

            <circle
              className="millstone-eye"
              cx="70"
              cy="78"
              r="11"
              fill="#2c1a0a"
              stroke="#c9963a"
              strokeWidth="2"
            />
            <circle className="millstone-core" cx="70" cy="78" r="4" fill="#f37021" />

            <circle cx="98" cy="58" r="5.5" fill="#6e5538" stroke="#5c4634" strokeWidth="1.2" />

            <g className="millstone-handle">
              <rect
                x="95.2"
                y="22"
                width="5.6"
                height="40"
                rx="2.6"
                fill="url(#millstone-handle-wood)"
                stroke="#4a2f14"
                strokeWidth="1"
              />
              <rect
                x="86"
                y="18"
                width="24"
                height="7"
                rx="3.2"
                fill="url(#millstone-handle-wood)"
                stroke="#4a2f14"
                strokeWidth="1"
              />
              <ellipse cx="98" cy="21.5" rx="11" ry="2.2" fill="#d4a574" opacity="0.35" />
            </g>
          </g>
        </svg>
      </div>
      <span className="millstone-label">{label}</span>
    </div>
  )

  if (overlay) {
    return <div className="millstone-overlay">{content}</div>
  }

  return content
}
