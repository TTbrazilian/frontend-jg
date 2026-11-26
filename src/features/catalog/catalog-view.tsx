import { useEffect, useId, useMemo, useRef, type RefObject } from 'react'
import { CATALOG_TABS, SORT_LABELS, SORT_OPTIONS, type CatalogTab, type SortOption } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { FilterIcon, WarningIcon } from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { useIsDesktop, useIsLarge, usePrefersReducedMotion } from '@/components/layout/use-media-query'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './catalog-filters'
import { CatalogPagination } from './catalog-pagination'
import { FeaturedBanner } from './featured-banner'
import { useFilterSheetOpen } from './filter-sheet-store'
import { useNftList } from './queries'
import { filtersKey, hasActiveFilters, PAGE_SIZE, toListParams, type CatalogSearch } from './search'
import { useCatalogNavigation, type CatalogPath } from './use-catalog-search'

const TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

/** Rola até o catálogo e move o foco para ele (EXPLORAR, paginação, chegada no Mercado). */
export function focusCatalog(el: HTMLElement | null, { smooth = true }: { smooth?: boolean } = {}) {
  if (!el) return
  el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  el.focus({ preventScroll: true })
}

const gridClass = cn(
  'grid grid-cols-2 gap-x-4 gap-y-6 pb-8',
  // Mobile do Figma: coluna da direita deslocada 32px ("masonry" leve).
  'max-md:[&>li:nth-child(even)]:translate-y-8',
  'md:grid-cols-3 md:gap-x-6 md:gap-y-[72px] md:pb-0 lg:gap-x-8',
)

function SortSelect({ value, onChange, stacked = false }: { value: SortOption; onChange: (v: SortOption) => void; stacked?: boolean }) {
  const id = useId()
  return (
    <div className={cn('flex', stacked ? 'flex-col gap-3' : 'items-center gap-1')}>
      <span id={id} className={cn(stacked ? 'text-title-sm font-bold leading-4' : 'text-body-md', 'text-foreground')}>
        Ordenar por:
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
        <SelectTrigger
          aria-labelledby={id}
          data-testid="catalog-sort"
          className={cn(
            'text-body-md',
            stacked ? 'h-10 w-full border-border bg-background' : 'h-8 w-auto gap-1 rounded-sm border-0 px-1 hover:text-text-accent',
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o} value={o}>
              {SORT_LABELS[o]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface CatalogViewProps {
  path: CatalogPath
  search: CatalogSearch
  /** Alvo de rolagem/foco (seção do catálogo). */
  sectionRef: RefObject<HTMLElement | null>
  /** Título (para leitores de tela) da seção. */
  heading: string
  showFeaturedBanner?: boolean
  className?: string
}

/**
 * Catálogo do Figma (Início e Mercado): filtros na sidebar (Sheet abaixo de 1024px), abas,
 * ordenação, grade 3×3 (2 colunas no mobile) e paginação. Todo o estado vem da URL.
 */
export function CatalogView({ path, search, sectionRef, heading, showFeaturedBanner = false, className }: CatalogViewProps) {
  const nav = useCatalogNavigation(path, search)
  const params = useMemo(() => toListParams(search), [search])
  const list = useNftList(params)
  const isLarge = useIsLarge()
  const isDesktop = useIsDesktop()
  const reduced = usePrefersReducedMotion()
  const [sheetOpen, setSheetOpen] = useFilterSheetOpen()
  const headingId = useId()
  // O Sheet é aberto por botões fora dele (header mobile/toolbar): devolvemos o foco a quem abriu.
  const sheetOpener = useRef<HTMLElement | null>(null)

  const data = list.data
  const facets = data?.facets
  const tab = search.tab ?? 'all'
  const sort = search.sort ?? 'recent'
  const activeCount = (search.category?.length ?? 0) + (search.network?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)

  // Acima de 1024px a sidebar volta; o Sheet não deve ficar aberto "escondido". Ao sair da página, fecha.
  useEffect(() => {
    if (isLarge && sheetOpen) setSheetOpen(false)
  }, [isLarge, sheetOpen, setSheetOpen])
  useEffect(() => () => setSheetOpen(false), [setSheetOpen])

  // Anuncia o total depois de cada mudança de filtro (e a página nova ao paginar) — nunca no 1º carregamento.
  const key = filtersKey(search)
  const page = params.page ?? 1
  const announced = useRef<{ key: string; page: number } | null>(null)
  useEffect(() => {
    if (!data || list.isPlaceholderData) return
    const prev = announced.current
    announced.current = { key, page }
    if (!prev) return
    if (prev.key !== key) announce(data.total === 0 ? 'Nenhum NFT encontrado.' : `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}.`)
    else if (prev.page !== page) announce(`Página ${data.page} de ${data.totalPages}.`)
  }, [data, list.isPlaceholderData, key, page])

  const onPageNavigate = () => window.requestAnimationFrame(() => focusCatalog(sectionRef.current, { smooth: !reduced }))

  let results: React.ReactNode
  if (list.isPending) {
    results = (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          Carregando NFTs…
        </span>
        <ul className={gridClass} aria-hidden>
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    )
  } else if (list.isError && !data) {
    results = (
      <div role="alert" className="flex flex-col items-center gap-4 rounded-lg border border-destructive/40 bg-card px-6 py-12 text-center" data-testid="catalog-error">
        <WarningIcon width={32} height={32} className="text-destructive" />
        <p className="text-title-sm font-bold text-foreground">Não foi possível carregar os NFTs.</p>
        <p className="max-w-md text-body text-text-secondary">{toApiError(list.error).message} Verifique sua conexão e tente novamente.</p>
        <Button type="button" variant="outline" onClick={() => void list.refetch()} loading={list.isFetching}>
          Tentar novamente
        </Button>
      </div>
    )
  } else if (data && data.items.length === 0) {
    results = (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card px-6 py-12 text-center" data-testid="catalog-empty">
        <p className="text-title-sm font-bold text-foreground">Nenhum NFT encontrado</p>
        <p className="max-w-md text-body text-text-secondary">
          {hasActiveFilters(search)
            ? 'Nenhum NFT corresponde à busca e aos filtros escolhidos. Tente outros termos ou remova alguns filtros.'
            : 'Ainda não há NFTs listados no mercado. Volte em breve.'}
        </p>
        {hasActiveFilters(search) ? (
          <Button type="button" variant="outline" onClick={() => nav.clearFilters()}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    )
  } else if (data) {
    results = (
      <>
        {list.isError ? (
          <p role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 px-4 py-2 text-body text-text-secondary">
            Não foi possível atualizar a lista.
            <Button type="button" variant="link" onClick={() => void list.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : null}
        <ul
          className={cn(gridClass, 'transition-opacity duration-200', list.isPlaceholderData && 'opacity-60')}
          aria-busy={list.isFetching || undefined}
          aria-labelledby={headingId}
          data-testid="catalog-grid"
        >
          {data.items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} headingLevel="h3" />
            </li>
          ))}
        </ul>
      </>
    )
  }

  const filtersButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setSheetOpen(true)}
      aria-haspopup="dialog"
      aria-label={activeCount ? `Filtros, ${activeCount} ativos` : 'Filtros'}
      data-testid="catalog-filters-button"
    >
      <FilterIcon width={18} height={18} />
      Filtros
      {activeCount ? (
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-tiny text-primary-foreground">
          {activeCount}
        </span>
      ) : null}
    </Button>
  )

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn('grid scroll-mt-6 gap-12 outline-none lg:grid-cols-[minmax(0,310px)_minmax(0,1fr)]', className)}
      data-testid="catalog"
    >
      {isLarge ? (
        <aside aria-label="Filtros do catálogo" className="flex flex-col gap-6">
          <div className="bg-card p-5">
            <CatalogFilters nav={nav} facets={facets} />
          </div>
          {showFeaturedBanner ? <FeaturedBanner /> : null}
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-col gap-10 md:gap-[88px]">
        <div className="flex flex-col">
          <h2 id={headingId} className="sr-only">
            {heading}
          </h2>
          <Tabs value={tab} onValueChange={(v) => nav.setFilters({ tab: v === 'all' ? undefined : (v as CatalogTab) })} activationMode="manual">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <TabsList aria-label="Listas do catálogo" className="-mb-1 gap-3 pb-1 md:gap-5">
                {CATALOG_TABS.map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    data-testid={`catalog-tab-${t}`}
                    className="leading-4 max-md:text-body max-md:font-normal max-md:data-[state=active]:font-bold"
                  >
                    {TAB_LABELS[t]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {isDesktop ? (
                <div className="flex items-center gap-4">
                  {!isLarge ? filtersButton : null}
                  <SortSelect value={sort} onChange={(v) => nav.setFilters({ sort: v === 'recent' ? undefined : v })} />
                </div>
              ) : null}
            </div>
            <TabsContent value={tab} className="mt-4 md:mt-8" tabIndex={-1}>
              {results}
            </TabsContent>
          </Tabs>
        </div>

        {data && !list.isError ? (
          <CatalogPagination path={path} search={search} page={data.page} totalPages={data.totalPages} onNavigate={onPageNavigate} />
        ) : null}
      </div>

      {!isLarge ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm gap-8 p-6 pt-8"
            aria-describedby={undefined}
            onOpenAutoFocus={() => {
              sheetOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            }}
            onCloseAutoFocus={(e) => {
              const opener = sheetOpener.current
              if (opener?.isConnected) {
                e.preventDefault()
                opener.focus()
              }
            }}
          >
            <SheetTitle className="text-heading leading-8">Filtros</SheetTitle>
            {!isDesktop ? <SortSelect value={sort} onChange={(v) => nav.setFilters({ sort: v === 'recent' ? undefined : v })} stacked /> : null}
            <CatalogFilters nav={nav} facets={facets} />
            <Button type="button" size="lg" className="mt-auto w-full shrink-0" onClick={() => setSheetOpen(false)}>
              {data ? `Ver ${data.total} ${data.total === 1 ? 'resultado' : 'resultados'}` : 'Ver resultados'}
            </Button>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}
