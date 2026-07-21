type Props = {
  section: string;
  label: string;
};

export function RevMgmtPageHeader({ section, label }: Props) {
  return (
    <h1 className="px-2 sm:px-3 pt-2 pb-1 text-base font-semibold uppercase tracking-wide bg-background">
      {section}
      <span className="mx-2 font-normal text-muted-foreground">/</span>
      {label}
    </h1>
  );
}
