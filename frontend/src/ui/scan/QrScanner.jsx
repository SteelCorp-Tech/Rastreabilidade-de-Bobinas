import { useEffect, useRef, useState } from 'react'
import { getQrDetector } from './detector.js'

/**
 * Leitor de QR pela câmera do tablet. Chama `onResult(texto)` na primeira leitura e fecha.
 * A câmera só funciona em HTTPS (ou localhost).
 */
export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const [msg, setMsg] = useState('Abrindo a câmera…')
  const [fatal, setFatal] = useState(false)

  useEffect(() => {
    let stream
    let stopped = false
    let timer

    async function start() {
      if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setFatal(true)
        setMsg('A câmera exige HTTPS (ou localhost). Use o leitor ou digite o CUB.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch (e) {
        setFatal(true)
        setMsg(e?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere no navegador ou digite o CUB.' : 'Não foi possível abrir a câmera. Digite o CUB.')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})
      setMsg('Aponte para o QR da etiqueta')
      const detector = await getQrDetector()
      const tick = async () => {
        if (stopped) return
        try {
          const found = video.readyState >= 2 ? await detector.detect(video) : []
          if (found.length) {
            stopped = true
            onResult(found[0].rawValue)
            return
          }
        } catch {
          // quadro inválido: tenta de novo
        }
        timer = setTimeout(tick, 150)
      }
      tick()
    }
    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  return (
    <div className="scanner" role="dialog" aria-label="Leitor de QR">
      <div className="scanner-box">
        {!fatal && <video ref={videoRef} playsInline muted />}
        {!fatal && <div className="scanner-frame" />}
        <p className={fatal ? 'err' : 'scanner-msg'}>{msg}</p>
        <button type="button" className="btn ghost big" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
