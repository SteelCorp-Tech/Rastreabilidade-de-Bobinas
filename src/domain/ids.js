/**
 * Identificadores internos (`mc-12`, `dl-3`, `coil-250`...). Nunca se repetem, nem depois de uma exclusão do
 * administrador: senão o histórico (AuditLog) de um registro excluído apareceria no registro novo.
 * `state.id_seq` guarda, por prefixo, o maior número que já saiu por exclusão.
 */

const numberOf = (id) => Number(String(id ?? '').split('-').pop()) || 0

/** Próximo número: maior entre o já usado (`floor`) e os ids existentes, mais 1. */
export function nextIdNumber(list, floor = 0) {
  let max = floor ?? 0
  for (const x of list) max = Math.max(max, numberOf(x.id))
  return max + 1
}

/** Novo `id_seq` registrando que os ids de `removed` não podem voltar. */
export function withRemovedIds(idSeq, prefix, removed) {
  const max = removed.reduce((m, x) => Math.max(m, numberOf(x.id)), idSeq?.[prefix] ?? 0)
  return { ...(idSeq ?? {}), [prefix]: max }
}
