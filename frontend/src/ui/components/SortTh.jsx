/** Cabeçalho de coluna clicável: ordena crescente e decrescente. `k` é a chave da coluna em useSort. */
export default function SortTh({ k, sort, onSort, children }) {
  const active = sort?.key === k
  const dir = active ? sort.dir : null
  return (
    <th className={active ? 'sorted' : ''} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" className="th-btn" onClick={() => onSort(k)} title="Ordenar por esta coluna">
        {children}
        <span className="si" aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>
      </button>
    </th>
  )
}
