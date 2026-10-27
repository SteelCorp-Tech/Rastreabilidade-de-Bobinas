import { useEffect, useState } from 'react'
import { getAttachment } from '../../persistence/attachmentStore.js'
import Modal from './Modal.jsx'

/**
 * Visualizar e baixar um anexo guardado no IndexedDB.
 * "Visualizar" abre o arquivo numa janela dentro do próprio app (PDF ou imagem): nova aba de navegador
 * é barrada por bloqueadores de pop-up e não existe no painel embutido.
 * @param {{file: {id: string, name: string}|null, empty?: string}} props
 */
export default function Attachment({ file, empty = 'Nenhum arquivo anexado' }) {
  const [msg, setMsg] = useState('')
  const [view, setView] = useState(null) // { url, type, name }

  useEffect(() => () => { if (view) URL.revokeObjectURL(view.url) }, [view])
  if (!file) return <span className="muted">{empty}</span>

  async function load() {
    setMsg('')
    const rec = await getAttachment(file.id).catch(() => null)
    if (!rec) {
      setMsg('Arquivo indisponível neste navegador.')
      return null
    }
    return rec
  }

  async function show() {
    const rec = await load()
    if (!rec) return
    const type = rec.blob.type || file.type || ''
    setView({ url: URL.createObjectURL(rec.blob), type, name: rec.name })
  }

  async function download() {
    const rec = await load()
    if (!rec) return
    const url = URL.createObjectURL(rec.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = rec.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const isImage = view?.type.startsWith('image/')
  const isPdf = view && !isImage && (view.type === 'application/pdf' || /\.pdf$/i.test(view.name))

  return (
    <span className="attachment">
      <span className="mono file-name">{file.name}</span>
      <button type="button" className="link" onClick={show}>Visualizar</button>
      <button type="button" className="link" onClick={download}>Baixar</button>
      {msg && <span className="err-inline">{msg}</span>}
      {view && (
        <Modal
          title={view.name}
          wide
          onClose={() => setView(null)}
          actions={<a className="btn ghost link-btn" href={view.url} download={view.name}>Baixar</a>}
        >
          {isImage && <img className="viewer-img" src={view.url} alt={view.name} />}
          {isPdf && <iframe className="viewer-frame" src={view.url} title={view.name} />}
          {!isImage && !isPdf && <p className="muted">Este tipo de arquivo não tem visualização. Use "Baixar".</p>}
        </Modal>
      )}
    </span>
  )
}
