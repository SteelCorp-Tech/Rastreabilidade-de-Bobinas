/**
 * Módulos do menu. `view` casa com `canView` (domain/permissions.js).
 * `increment` indica em qual incremento a tela ganha conteúdo (plano de entrega).
 */
export const MODULES = [
  { view: 'home', path: '/', label: 'Início', desc: 'Visão geral', icon: 'home', group: null, increment: 0 },
  { view: 'search', path: '/consulta', label: 'Consulta', desc: 'CUB, lote, NF, OP, obra, certificado', icon: 'search', group: null, increment: 8 },
  { view: 'motherCoils', path: '/bobinas-mae', label: 'Bobinas mãe', desc: 'Certificado e NF por lote', icon: 'coil', group: 'Operação', increment: 4 },
  { view: 'cuttingPlans', path: '/planos-de-corte', label: 'Plano de corte', desc: 'Tiras, refilo e CUBs previstos', icon: 'scissors', group: 'Operação', increment: 5 },
  { view: 'deliveries', path: '/recebimento', label: 'Recebimento', desc: 'Entregas, CUBs e etiquetas', icon: 'truck', group: 'Operação', increment: 6 },
  { view: 'stock', path: '/estoque', label: 'Estoque de CUBs', desc: 'Saldos e posição', icon: 'box', group: 'Operação', increment: 6 },
  { view: 'coilUse', path: '/uso', label: 'Uso de bobina', desc: 'Montagem e sobra, no tablet', icon: 'play', group: 'Operação', increment: 7 },
  { view: 'blocks', path: '/bloqueios', label: 'Bloqueio e liberação', desc: 'Qualidade', icon: 'lock', group: 'Qualidade', increment: 8 },
  { view: 'reports', path: '/recall', label: 'Recall e relatórios', desc: 'Lote, balanço de massa, pendências', icon: 'report', group: 'Qualidade', increment: 8 },
  { view: 'registry', path: '/cadastros', label: 'Cadastros', desc: 'Fornecedores, obras, catálogo', icon: 'users', group: 'Sistema', increment: 3 },
  { view: 'audit', path: '/auditoria', label: 'Auditoria', desc: 'Registro de eventos', icon: 'list', group: 'Sistema', increment: 8 },
  { view: 'settings', path: '/configuracoes', label: 'Configurações', desc: 'Limite de peso, CUB, certificado', icon: 'gear', group: 'Sistema', increment: 3 },
]
