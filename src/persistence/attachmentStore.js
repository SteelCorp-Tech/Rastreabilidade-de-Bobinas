/**
 * Anexos (certificado, NF, romaneio) no IndexedDB: comporta PDFs sem estourar o limite do localStorage.
 * O estado guarda só a referência (`{id, name, type, size}`), nunca o arquivo.
 */
const DB_NAME = 'bobinas:v1:files'
const STORE = 'files'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req?.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

/** Grava o arquivo e devolve a referência para guardar no estado. @param {File|Blob} blob */
export async function putAttachment(blob, { id = crypto.randomUUID(), name = blob.name ?? 'arquivo' } = {}) {
  await tx('readwrite', (s) => s.put({ blob, name, type: blob.type }, id))
  return { id, name, type: blob.type, size: blob.size }
}

/** @returns {Promise<{blob: Blob, name: string, type: string}|null>} */
export async function getAttachment(id) {
  return (await tx('readonly', (s) => s.get(id))) ?? null
}

export async function hasAttachment(id) {
  return (await tx('readonly', (s) => s.count(id))) > 0
}

/** PDF mínimo e válido, usado como certificado-modelo nos dados de exemplo. */
export function buildModelPdf(lines) {
  const esc = (t) => t.replace(/[\\()]/g, '\\$&')
  const body = ['BT', '/F1 16 Tf', '56 780 Td', ...lines.flatMap((l, i) => [i ? '0 -26 Td' : '', `(${esc(l)}) Tj`])].filter(Boolean).join('\n')
  const stream = `${body}\nET`
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`
  return new Blob([pdf], { type: 'application/pdf' })
}

/** Garante no IndexedDB os anexos referenciados pelos dados de exemplo. */
export async function ensureSeedAttachments(ref) {
  if (await hasAttachment(ref.id)) return
  const blob = buildModelPdf(['CERTIFICADO DE QUALIDADE - MODELO', 'Arquivo de exemplo do prototipo de rastreabilidade.', 'Em producao, aqui fica o certificado emitido pela usina.'])
  await putAttachment(blob, { id: ref.id, name: ref.name })
}
