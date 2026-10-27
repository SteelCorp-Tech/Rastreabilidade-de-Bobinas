/** Campo de arquivo (PDF ou imagem). `value` é o File escolhido. */
export default function FileField({ label, value, onChange, required, hint }) {
  return (
    <label className="file-field">
      <span className="eyebrow">{label}{required && ' *'}</span>
      <input type="file" accept="application/pdf,image/*" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {value && <small className="muted mono">{value.name} · {Math.max(1, Math.round(value.size / 1024))} KB</small>}
      {hint && !value && <small className="muted">{hint}</small>}
    </label>
  )
}
