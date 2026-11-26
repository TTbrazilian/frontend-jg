import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Container } from '@/components/layout/container'
import { buttonVariants } from '@/components/ui/button'

/** 404 global (rota inexistente), no padrão visual do app. */
export function NotFoundPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Página não encontrada — Kurio'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center md:py-28" data-testid="not-found">
      <p aria-hidden className="text-[4.5rem] font-bold leading-none text-primary md:text-[6rem]">
        404
      </p>
      <h1 className="text-heading font-bold text-foreground">Página não encontrada</h1>
      <p className="max-w-md text-body leading-6 text-text-secondary">
        O endereço que você acessou não existe ou foi movido. Que tal explorar os NFTs do mercado?
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonVariants({ size: 'lg' })}>
          Voltar ao início
        </Link>
        <Link to="/mercado" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Explorar o mercado
        </Link>
      </div>
    </Container>
  )
}
