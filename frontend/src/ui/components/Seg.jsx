/** Controle segmentado com contadores, como o filtro "Todos · ERP" do portal. */
export default function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="seg-count mono">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
