import { describe, it, expect } from 'vitest'
import { compareValues, sortRows } from './sortRows.js'

const ids = (rows) => rows.map((r) => r.id)

describe('ordenação de colunas', () => {
  it('números como números, não como texto', () => {
    const rows = [{ id: 'a', v: 10 }, { id: 'b', v: 9 }, { id: 'c', v: 100 }]
    expect(ids(sortRows(rows, (r) => r.v, 'asc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortRows(rows, (r) => r.v, 'desc'))).toEqual(['c', 'a', 'b'])
  })
  it('textos em ordem natural: lote 9843 antes de 10001, CUB-2026-00009 antes de CUB-2026-00010', () => {
    const rows = [{ id: 'x', v: '10001' }, { id: 'y', v: '9843' }, { id: 'z', v: '9849' }]
    expect(ids(sortRows(rows, (r) => r.v))).toEqual(['y', 'z', 'x'])
    expect(compareValues('CUB-2026-00009', 'CUB-2026-00010')).toBeLessThan(0)
  })
  it('sem diferenciar maiúsculas e com acentos próximos', () => {
    const rows = [{ id: '1', v: 'ásia' }, { id: '2', v: 'Brasil' }, { id: '3', v: 'amafer' }]
    expect(ids(sortRows(rows, (r) => r.v))).toEqual(['3', '1', '2'])
  })
  it('valores vazios ficam sempre no fim, crescente ou decrescente', () => {
    const rows = [{ id: 'a', v: null }, { id: 'b', v: 5 }, { id: 'c', v: '' }, { id: 'd', v: 1 }, { id: 'e', v: undefined }]
    expect(ids(sortRows(rows, (r) => r.v, 'asc'))).toEqual(['d', 'b', 'a', 'c', 'e'])
    expect(ids(sortRows(rows, (r) => r.v, 'desc'))).toEqual(['b', 'd', 'a', 'c', 'e'])
  })
  it('empates mantêm a ordem anterior (estável) e a lista original não muda', () => {
    const rows = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 0 }]
    const copy = [...rows]
    expect(ids(sortRows(rows, (r) => r.v, 'asc'))).toEqual(['c', 'a', 'b'])
    expect(ids(sortRows(rows, (r) => r.v, 'desc'))).toEqual(['a', 'b', 'c'])
    expect(rows).toEqual(copy)
  })
})
