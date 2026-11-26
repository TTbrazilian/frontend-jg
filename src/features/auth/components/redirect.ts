/**
 * Destino pós-login vindo de `?redirect=`: só caminhos internos ("/x"), nunca
 * protocolo-relativos ("//host"), barras invertidas ou caracteres de controle/espaço
 * (que navegadores normalizam). Voltar para /login ou /cadastro vira "/".
 */
export function safeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return '/'
  if (isAuthPath(raw)) return '/'
  return raw
}

const PROTECTED = /^\/(pagamento|pedido|perfil)(?=[/?#]|$)/
const AUTH = /^\/(login|cadastro)(?=[/?#]|$)/

/** Rotas que exigem sessão (ver `requireAuth` em src/router.tsx). */
export function isProtectedPath(path: string): boolean {
  return PROTECTED.test(path)
}

export function isAuthPath(path: string): boolean {
  return AUTH.test(path)
}
