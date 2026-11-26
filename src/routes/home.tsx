import { useRef } from 'react'
import { useMatch } from '@tanstack/react-router'
import { Container } from '@/components/layout/container'
import { usePrefersReducedMotion } from '@/components/layout/use-media-query'
import { CatalogView, focusCatalog } from '@/features/catalog/catalog-view'
import { BlogSection, PromoCards } from '@/features/catalog/home-editorial'
import { HomeHero } from '@/features/catalog/home-hero'
import { EMPTY_CATALOG_SEARCH } from '@/features/catalog/search'

/**
 * Início (Figma "Desktop/Mobile · Início"): hero de destaques, catálogo com filtros, promoções e
 * "Diário da Cunhagem". O estado do catálogo vem da busca validada da rota `/`. Fora dela (fundo
 * do diálogo de login no desktop), o catálogo usa o estado padrão.
 */
export function HomePage() {
  const match = useMatch({ from: '/', shouldThrow: false })
  const search = match?.search ?? EMPTY_CATALOG_SEARCH
  const catalogRef = useRef<HTMLElement>(null)
  const reduced = usePrefersReducedMotion()

  return (
    <Container className="flex flex-col gap-6 pb-16 pt-4 md:gap-24 md:pb-24 md:pt-8">
      <HomeHero onExplore={() => focusCatalog(catalogRef.current, { smooth: !reduced })} />
      <CatalogView path="/" search={search} sectionRef={catalogRef} heading="Catálogo de NFTs" showFeaturedBanner />
      <PromoCards className="max-md:mt-10" />
      <BlogSection />
    </Container>
  )
}
