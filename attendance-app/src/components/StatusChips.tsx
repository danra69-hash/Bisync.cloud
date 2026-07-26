type Chip = { key: string; label: string }

export function StatusChips({
  chips,
  activeKey,
  onChange,
}: {
  chips: readonly Chip[]
  activeKey: string
  onChange: (key: string) => void
}) {
  return (
    <div className="chips">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={`chip${chip.key === activeKey ? ' active' : ''}`}
          onClick={() => onChange(chip.key)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
