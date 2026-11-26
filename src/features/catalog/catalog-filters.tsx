import { useId } from 'react'
import { CATEGORIES, CATEGORY_LABELS, NETWORKS, NETWORK_LABELS, type CatalogFacets } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PriceRange } from './price-range'
import { hasActiveFilters } from './search'
import type { CatalogNavigation } from './use-catalog-search'

interface FilterOptionProps {
  label: string
  count: number | undefined
  checked: boolean
  onToggle: () => void
  testId: string
  boldCount?: boolean
}

/**
 * Linha de filtro do Figma ("Arte digital ...... (33)") como checkbox acessível.
 * O estado não depende só da cor: o marcador circular fica preenchido quando ativo.
 */
function FilterOption({ label, count, checked, onToggle, testId, boldCount = false }: FilterOptionProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      aria-label={count === undefined ? label : `${label}, ${count} ${count === 1 ? 'NFT' : 'NFTs'}`}
      data-testid={testId}
      className={cn(
        'group/opt flex h-10 w-full items-center justify-between gap-3 rounded-sm text-left text-body-md leading-10 transition-colors',
        checked ? 'text-text-accent' : 'text-text-secondary hover:text-foreground',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
            checked ? 'border-primary' : 'border-border-soft group-hover/opt:border-primary/70',
          )}
        >
          <span className={cn('size-1.5 rounded-full', checked ? 'bg-primary' : 'bg-transparent')} />
        </span>
        <span className="truncate">{label}</span>
      </span>
      {count === undefined ? (
        <Skeleton className="h-4 w-8" />
      ) : (
        <span aria-hidden className={cn('shrink-0 tabular-nums', boldCount && 'font-bold')}>
          ({count})
        </span>
      )}
    </button>
  )
}

function FilterGroup({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <h3 id={id} className="text-title-sm font-bold leading-4 text-foreground">
        {title}
      </h3>
      <div role="group" aria-labelledby={id}>
        {children}
      </div>
    </div>
  )
}

const toggle = <T extends string>(list: T[] | undefined, value: T): T[] | undefined => {
  const set = new Set(list ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort() : undefined
}

interface CatalogFiltersProps {
  nav: CatalogNavigation
  facets: CatalogFacets | undefined
  className?: string
}

/** Filtros do Figma (Coleções, Faixa de preço, Rede): sidebar no desktop, Sheet abaixo de 1024px. */
export function CatalogFilters({ nav, facets, className }: CatalogFiltersProps) {
  const { search, setFilters, clearFilters } = nav
  const active = hasActiveFilters(search)

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <FilterGroup title="Coleções">
        <ul className="flex flex-col px-3">
          {CATEGORIES.map((slug) => (
            <li key={slug}>
              <FilterOption
                label={CATEGORY_LABELS[slug]}
                count={facets?.categories[slug]}
                checked={!!search.category?.includes(slug)}
                onToggle={() => setFilters({ category: toggle(search.category, slug) })}
                testId={`filter-category-${slug}`}
                boldCount
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Faixa de preço">
        <PriceRange
          bounds={facets?.priceRange}
          min={search.minPrice}
          max={search.maxPrice}
          onApply={({ minPrice, maxPrice }) => setFilters({ minPrice, maxPrice })}
        />
      </FilterGroup>

      <FilterGroup title="Rede">
        <ul className="flex flex-col pl-3">
          {NETWORKS.map((id) => (
            <li key={id}>
              <FilterOption
                label={NETWORK_LABELS[id]}
                count={facets?.networks[id]}
                checked={!!search.network?.includes(id)}
                onToggle={() => setFilters({ network: toggle(search.network, id) })}
                testId={`filter-network-${id}`}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      {active ? (
        <button
          type="button"
          onClick={() => clearFilters()}
          className="-mt-4 w-fit rounded-xs text-body font-bold text-text-accent underline-offset-4 hover:underline"
          data-testid="clear-filters"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  )
}
