import type { LegalSection } from '../../data/legalShared';

type Props = {
  title: string;
  version: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
  className?: string;
};

export function LegalDocument({
  title,
  version,
  effectiveDate,
  intro,
  sections,
  className = '',
}: Props) {
  return (
    <article className={`space-y-5 text-sm leading-relaxed text-herme-ink/85 ${className}`}>
      <header className="space-y-1 border-b border-herme-muted/50 pb-4">
        <h1 className="text-lg font-bold text-herme-ink">{title}</h1>
        <p className="text-xs text-herme-ink/55">
          Version {version} · Effective {effectiveDate}
        </p>
      </header>

      {intro.map((paragraph, index) => (
        <p key={`intro-${index}`}>{paragraph}</p>
      ))}

      {sections.map(section => (
        <section key={section.id} id={section.id} className="space-y-2 scroll-mt-4">
          <h2 className="text-sm font-semibold text-herme-ink">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={`${section.id}-${index}`}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
