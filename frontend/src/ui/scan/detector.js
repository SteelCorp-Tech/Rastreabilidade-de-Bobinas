import { parseCub } from '@dominio/cub.js'

let pending = null

/**
 * Detector de QR. Usa o BarcodeDetector nativo (Chrome/Android) quando existe e lê QR; senão cai no ponyfill
 * (ZXing em WebAssembly), com o .wasm servido pelo próprio app, sem CDN, para funcionar no Safari/iPad e offline.
 */
export function getQrDetector() {
  pending ??= (async () => {
    if ('BarcodeDetector' in globalThis) {
      try {
        const formats = await globalThis.BarcodeDetector.getSupportedFormats()
        if (formats.includes('qr_code')) return new globalThis.BarcodeDetector({ formats: ['qr_code'] })
      } catch {
        // cai no ponyfill
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ])
    prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
    return new BarcodeDetector({ formats: ['qr_code'] })
  })()
  return pending
}

/** Texto lido (QR ou leitor físico) → CUB normalizado, ou null se não for um CUB. */
export function cubFromScan(raw) {
  const text = String(raw ?? '').trim().toUpperCase()
  const p = parseCub(text)
  return p ? text : null
}
