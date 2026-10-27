import { useState } from 'react'

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
const isEmpty = (v) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))

/** Compara dois valores: números como números; textos em ordem natural pt-BR ("9" antes de "10", sem diferenciar maiúsculas). */
export function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/**
 * Ordena sem alterar a lista original. Valores vazios ficam sempre no fim, em qualquer direção; empates mantêm a ordem anterior.
 * @param {T[]} rows @param {(row: T) => any} accessor @param {'asc'|'desc'} dir @template T
 */
export function sortRows(rows, accessor, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1
  return rows
    .map((row, i) => ({ row, i, v: accessor(row) }))
    .sort((x, y) => {
      const xe = isEmpty(x.v)
      const ye = isEmpty(y.v)
      if (xe || ye) return xe === ye ? x.i - y.i : xe ? 1 : -1
      return compareValues(x.v, y.v) * sign || x.i - y.i
    })
    .map((x) => x.row)
}

/**
 * Ordenação por clique no nome da coluna: 1º clique crescente, 2º decrescente, e assim por diante.
 * Sem coluna escolhida, mantém a ordem da tela.
 * @param {T[]} rows @param {Record<string, (row: T) => any>} accessors @template T
 */
export function useSort(rows, accessors) {
  const [sort, setSort] = useState(null)
  const toggle = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const accessor = sort && accessors[sort.key]
  return { rows: accessor ? sortRows(rows, accessor, sort.dir) : rows, sort, toggle }
}
