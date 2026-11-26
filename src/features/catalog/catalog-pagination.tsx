import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon, ChevronRightIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { toUrlSearch, type CatalogSearch } from './search'
import type { CatalogPath } from './use-catalog-search'

/** Páginas exibidas: todas até 7; acima disso, primeira, última e vizinhas da atual com reticências. */
export function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

const box = 'grid h-[35px] min-w-[35px] place-items-center rounded-sm border px-2 text-title-sm leading-4 transition-colors'

interface CatalogPaginationProps {
  path: CatalogPath
  search: CatalogSearch
  page: number
  totalPages: number
  /** Chamado ao trocar de página (rolar até a grade e mover o foco). */
  onNavigate: () => void
  className?: string
}

/** Paginação do Figma: quadrados 35px, atual preenchido em laranja; links reais (abrem em nova aba, histórico funciona). */
export function CatalogPagination({ path, search, page, totalPages, onNavigate, className }: CatalogPaginationProps) {
  if (totalPages <= 1) return null
  const href = (p: number) => toUrlSearch({ ...search, page: p })

  return (
    <nav aria-label="Paginação do catálogo" className={cn('flex justify-end', className)} data-testid="pagination">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <Link to={path} search={href(page - 1)} resetScroll={false} onClick={onNavigate} aria-label="Página anterior" className={cn(box, 'border-border text-foreground hover:border-primary')}>
              <ArrowLeftIcon width={18} height={18} />
            </Link>
          </li>
        ) : null}
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-title-sm text-text-secondary">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                to={path}
                search={href(p)}
                resetScroll={false}
                onClick={onNavigate}
                aria-label={`Página ${p}`}
                aria-current={p === page ? 'page' : undefined}
                data-testid={`pagination-page-${p}`}
                className={cn(
                  box,
                  p === page
                    ? 'border-primary bg-primary font-bold text-primary-foreground'
                    : 'border-border font-normal text-foreground hover:border-primary hover:text-text-accent',
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link to={path} search={href(page + 1)} resetScroll={false} onClick={onNavigate} aria-label="Próxima página" className={cn(box, 'border-border text-foreground hover:border-primary')}>
              <ChevronRightIcon width={18} height={18} />
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
