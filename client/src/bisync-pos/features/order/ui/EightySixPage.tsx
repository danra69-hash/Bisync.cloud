import { MOCK_EIGHTY_SIX } from '../domain/ordering'
import { FeaturePage } from '../../common/FeaturePage'

export function EightySixPage() {
  return (
    <FeaturePage
      crumb="Order / 86 Board"
      title="Real-Time 86 Status"
      subtitle="Servers see out-of-stock and low items instantly so they never sell what the kitchen cannot make."
    >
      <div className="panel-grid">
        {MOCK_EIGHTY_SIX.map((item) => (
          <div key={item.productId} className="panel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <h3>{item.name}</h3>
              <span className={`status-pill status-pill--${item.status}`}>
                {item.status === '86' ? '86' : 'Low'}
              </span>
            </div>
            <p>{item.note ?? 'Unavailable'}</p>
          </div>
        ))}
      </div>
    </FeaturePage>
  )
}
