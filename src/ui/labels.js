/** Textos de interface (pt-BR) para códigos do domínio. */
export const MOTHER_STATUS = {
  REGISTERED: { label: 'Registrada', tone: '' },
  PLANNED: { label: 'Plano enviado', tone: '' },
  SCHEDULED: { label: 'Programada', tone: '' },
  RECEIVED: { label: 'Tiras recebidas', tone: 'ok' },
  BLOCKED: { label: 'Bloqueada', tone: 'bad' },
}

export const COIL_STATUS = {
  IN_STOCK: { label: 'Em estoque', tone: 'ok' },
  IN_USE: { label: 'Em uso', tone: '' },
  BLOCKED: { label: 'Bloqueada', tone: 'bad' },
  CONSUMED: { label: 'Consumida', tone: 'off' },
  RETURNED: { label: 'Enviada/devolvida', tone: 'off' },
}

export const AUDIT_ACTIONS = {
  'motherCoil.create': 'Bobina mãe registrada',
  'motherCoil.attachCertificate': 'Certificado anexado',
  'motherCoil.replaceCertificate': 'Certificado substituído',
  'motherCoil.schedule': 'Programação confirmada',
  'cuttingPlan.save': 'Plano de corte salvo',
  'cuttingPlan.send': 'Plano de corte enviado',
  'delivery.receive': 'Entrega recebida',
  'coilUse.open': 'Uso aberto',
  'coilUse.close': 'Uso fechado',
  'coil.block': 'CUB bloqueado',
  'coil.unblock': 'CUB liberado',
  'lot.block': 'Lote bloqueado',
  'lot.unblock': 'Lote liberado',
  'config.update': 'Configuração alterada',
  'permissions.update': 'Permissões do perfil alteradas',
  'permissions.reset': 'Permissões do perfil restauradas ao padrão',
  'motherCoil.delete': 'Bobina mãe excluída',
  'cuttingPlan.delete': 'Plano de corte excluído',
  'delivery.delete': 'Recebimento excluído',
  'data.reset': 'Todos os dados apagados',
}
export const auditLabel = (action) => AUDIT_ACTIONS[action] ?? action
