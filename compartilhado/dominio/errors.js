/**
 * Erro de regra de negócio. `code` é estável (para testes e UI); `message` está em pt-BR
 * e diz o motivo da recusa.
 */
export class DomainError extends Error {
  /** @param {string} code @param {string} message @param {object} [details] */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

/** @param {boolean} cond @param {string} code @param {string} message */
export function ensure(cond, code, message, details) {
  if (!cond) throw new DomainError(code, message, details)
}
