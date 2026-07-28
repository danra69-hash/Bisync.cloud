import { COURSE_LABEL, MODIFIER_GROUPS, type Course } from '../domain/ordering'
import { FeaturePage } from '../../common/FeaturePage'

export function ModifiersPage() {
  return (
    <FeaturePage
      crumb="Order / Modifiers"
      title="Modifiers, Courses & Allergies"
      subtitle="Seat-level notes, coursing/firing, and allergy tags that travel with the ticket to the kitchen."
    >
      <div className="panel-grid">
        {MODIFIER_GROUPS.map((group) => (
          <div key={group.id} className="panel-card">
            <h3>{group.name}</h3>
            <p>{group.required ? 'Required' : 'Optional'} · customer customization</p>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: 'var(--color-ink)' }}>
              {group.options.map((opt) => (
                <li key={opt.id}>{opt.label}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="panel-card">
          <h3>Coursing & firing</h3>
          <p>Hold or fire courses at the right moment.</p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18 }}>
            {(Object.keys(COURSE_LABEL) as Course[]).map((c) => (
              <li key={c}>{COURSE_LABEL[c]}</li>
            ))}
          </ul>
        </div>
        <div className="panel-card">
          <h3>Allergy alerts</h3>
          <p>Gluten, dairy, nuts, shellfish, egg, soy — flagged on KDS tickets.</p>
        </div>
        <div className="panel-card">
          <h3>Seat-level ordering</h3>
          <p>Assign dishes to seat numbers so runners never auction plates.</p>
        </div>
      </div>
    </FeaturePage>
  )
}
