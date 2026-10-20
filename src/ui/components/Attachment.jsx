import { useState } from 'react'
import { getAttachment } from '../../persistence/attachmentStore.js'

/** Visualizar e baixar um anexo guardado no IndexedDB. @param {{file: {id: string, name: string}|null, empty?: string}} props */
export default function Attachment({ file, empty = 'Nenhum arquivo anexado' }) {
  const [msg, setMsg] = useState('')
  if (!file) return <span className="muted">{empty}</span>

  async function open(download) {
    setMsg('')
    const rec = await getAttachment(file.id).catch(() => null)
    if (!rec) {
      setMsg('Arquivo indisponível neste navegador.')
      return
    }
    const url = URL.createObjectURL(rec.blob)
    if (download) {
      const a = document.createElement('a')
      a.href = url
      a.download = rec.name
      a.click()
    } else {
      window.open(url, '_blank', 'noopener')
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <span className="attachment">
      <span className="mono file-name">{file.name}</span>
      <button type="button" className="link" onClick={() => open(false)}>Visualizar</button>
      <button type="button" className="link" onClick={() => open(true)}>Baixar</button>
      {msg && <span className="err-inline">{msg}</span>}
    </span>
  )
}
