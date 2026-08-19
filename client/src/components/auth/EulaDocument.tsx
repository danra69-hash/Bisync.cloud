import {
  CURRENT_EULA_VERSION,
  EULA_EFFECTIVE_DATE,
  EULA_INTRO,
  EULA_SECTIONS,
  EULA_TITLE,
} from '../../data/eula';

export function EulaDocument({
  className = '',
  hideChrome = false,
}: {
  className?: string;
  hideChrome?: boolean;
}) {
  return (
    <article className={`space-y-5 text-sm leading-relaxed text-herme-ink/85 ${className}`}>
      {!hideChrome ? (
        <header className="space-y-1 border-b border-herme-muted/50 pb-4">
          <h1 className="text-lg font-bold text-herme-ink">{EULA_TITLE}</h1>
          <p className="text-xs text-herme-ink/55">
            Version {CURRENT_EULA_VERSION} · Effective {EULA_EFFECTIVE_DATE}
          </p>
        </header>
      ) : null}

      {EULA_INTRO.map(paragraph => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}

      {EULA_SECTIONS.map(section => (
        <section key={section.id} id={section.id} className="space-y-2 scroll-mt-4">
          <h2 className="text-sm font-semibold text-herme-ink">{section.heading}</h2>
          {section.paragraphs.map(paragraph => (
            <p key={paragraph.slice(0, 64)}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
