import type { ReactNode } from 'react'
import './FeaturePage.css'

type Props = {
  crumb: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function FeaturePage({ crumb, title, subtitle, actions, children }: Props) {
  return (
    <div className="feature-page">
      <header className="feature-page__header">
        <div>
          <p className="feature-page__crumb">{crumb}</p>
          <h1>{title}</h1>
          {subtitle && <p className="feature-page__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="feature-page__actions">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
