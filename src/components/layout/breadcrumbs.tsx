import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  /** Caminho interno. Sem `to`, o item é a página atual (aria-current="page"). */
  to?: string
}

/** Trilha de navegação do Figma ("Início / Mercado"), Roboto Mono Bold 15. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Trilha" className={cn('text-body-md font-bold leading-4 text-foreground', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? (
              <li aria-hidden className="text-text-secondary">
                /
              </li>
            ) : null}
            <li className="min-w-0">
              {item.to ? (
                <Link to={item.to} className="rounded-xs underline-offset-4 hover:text-text-accent hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="block truncate text-text-accent">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
