import { useEffect, useRef } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Container } from '@/components/layout/container'
import { CatalogView } from '@/features/catalog/catalog-view'

const route = getRouteApi('/mercado')

/** Mercado: o mesmo catálogo do Início, sem o hero; ao chegar, o foco vai para a grade. */
export function MarketPage() {
  const search = route.useSearch()
  const catalogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Só na chegada (não a cada filtro): leva leitores de tela e teclado direto aos resultados.
    catalogRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <Container className="flex flex-col gap-6 pb-16 pt-4 md:gap-8 md:pb-24 md:pt-8">
      <h1 className="sr-only">Mercado de NFTs</h1>
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} className="max-md:hidden" />
      <CatalogView path="/mercado" search={search} sectionRef={catalogRef} heading="Resultados do mercado" />
    </Container>
  )
}
