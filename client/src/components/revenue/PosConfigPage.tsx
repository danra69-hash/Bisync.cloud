import { pageShellClass } from '../layout/pageLayout'

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

const SECTIONS = [
  {
    title: 'Tax & service charge',
    description: 'Default tax rates, service charge, and how they apply on the register.',
  },
  {
    title: 'Menus & dayparts',
    description: 'Daypart windows and which menus are available by time of day.',
  },
  {
    title: 'Receipt & print defaults',
    description: 'Guest check footer, tip lines, and default print behavior.',
  },
  {
    title: 'Table QR',
    description: 'Fixed vs dynamic table QR. Live control also lives under POS Setup in the web app.',
  },
  {
    title: 'Delivery apps',
    description: 'Channel mapping and fulfillment defaults for delivery partners.',
  },
] as const

export function PosConfigPage({ selectedCompanyId }: Props) {
  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open POS Config.</p>
      </div>
    )
  }

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">POS Config</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Outlet POS settings for the selected company. Device and printer setup stays under Device Management.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(section => (
          <section
            key={section.title}
            className="rounded-lg border border-border bg-card p-3 space-y-1.5"
          >
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{section.description}</p>
            <p className="text-[11px] text-muted-foreground/80 pt-1">Configuration coming next</p>
          </section>
        ))}
      </div>
    </div>
  )
}
