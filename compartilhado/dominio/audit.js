/**
 * AuditLog: lista só de inclusão. Não há função de edição nem de exclusão.
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} at
 * @property {{role: string, user: string}} actor
 * @property {string} action
 * @property {string} entity
 * @property {string} entity_id
 * @property {*} before
 * @property {*} after
 * @property {string} [reason]
 */

/** @param {AuditEntry[]} log @returns {AuditEntry[]} nova lista, com a entrada ao final */
export function appendAudit(log, { actor, action, entity, entity_id, before = null, after = null, reason }, now) {
  return [
    ...log,
    {
      id: `au-${log.length + 1}`,
      at: now.toISOString(),
      actor,
      action,
      entity,
      entity_id,
      before,
      after,
      ...(reason ? { reason } : {}),
    },
  ]
}
