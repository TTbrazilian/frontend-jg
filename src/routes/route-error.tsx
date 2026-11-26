import { useEffect, useRef } from 'react'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { WarningIcon } from '@/components/icons'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'

/**
 * Erro inesperado de rota (render/loader). Pode substituir o layout raiz, por isso traz a marca
 * e um caminho de volta ao início. "Tentar novamente" limpa o erro e recarrega a rota.
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryReset = useQueryErrorResetBoundary()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const message = toApiError(error).message

  useEffect(() => {
    queryReset.reset()
    headingRef.current?.focus()
  }, [queryReset])

  const retry = () => {
    reset()
    void router.invalidate()
  }

  return (
    <Container className="flex min-h-[60dvh] flex-1 flex-col items-center justify-center gap-5 py-20 text-center" data-testid="route-error">
      <a href="/" className="rounded-xs text-body font-bold tracking-[0.1em] text-foreground">
        KURIO<span className="sr-only"> — página inicial</span>
      </a>
      <WarningIcon width={40} height={40} className="text-destructive" />
      <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-foreground outline-none">
        Algo deu errado
      </h1>
      <p role="alert" className="max-w-md text-body leading-6 text-text-secondary">
        Não foi possível exibir esta página. {message}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={retry}>
          Tentar novamente
        </Button>
        <a href="/" className="inline-flex h-12 items-center justify-center rounded-md border border-primary px-6 text-body-lg font-bold text-text-accent hover:bg-primary/10">
          Voltar ao início
        </a>
      </div>
    </Container>
  )
}
