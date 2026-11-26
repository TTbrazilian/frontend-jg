import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { SearchIcon } from '@/components/icons'
import { catalogSearchSchema, EMPTY_CATALOG_SEARCH, toUrlSearch, withFilterChange } from '@/features/catalog/search'
import { cn } from '@/lib/utils'
import { isCatalogPath } from './route-flags'

/** Busca atual (somente nas rotas do catálogo) e função que aplica uma nova busca. */
function useCatalogSearchSubmit() {
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const onCatalog = isCatalogPath(location.pathname)
  const raw = onCatalog ? (location.search as { q?: unknown }).q : undefined
  const current = raw === undefined || raw === null ? '' : String(raw)

  const submit = (value: string) => {
    const q = value.trim().slice(0, 80) || undefined
    // No catálogo: preserva filtros e rota atual, reinicia a paginação. Fora dele: abre o Mercado.
    const base = onCatalog ? catalogSearchSchema.parse(location.search) : EMPTY_CATALOG_SEARCH
    const to = location.pathname === '/' ? '/' : '/mercado'
    void navigate({ to, search: toUrlSearch(withFilterChange(base, { q })), resetScroll: !onCatalog })
  }
  return { current, submit }
}

/** Busca mobile do Figma: barra "Explorar coleções" sempre visível. */
export function MobileSearchBar({ className }: { className?: string }) {
  const { current, submit } = useCatalogSearchSubmit()
  const [value, setValue] = useState(current)
  const id = useId()
  useEffect(() => setValue(current), [current])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(value)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn('flex h-[45px] min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-card pl-3 pr-3', className)}>
      <button type="submit" className="relative -m-2 grid size-10 shrink-0 place-items-center text-sand" aria-label="Buscar">
        <SearchIcon width={20} height={20} />
      </button>
      <label htmlFor={id} className="sr-only">
        Buscar NFTs e coleções
      </label>
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={80}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Explorar coleções"
        className="h-full min-w-0 flex-1 bg-transparent text-body font-bold text-foreground placeholder:text-sand focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        data-testid="search-input"
      />
    </form>
  )
}

/** Busca desktop: o ícone do header abre o campo; Esc fecha e devolve o foco ao ícone. */
export function HeaderSearch() {
  const { current, submit } = useCatalogSearchSubmit()
  const [open, setOpen] = useState(!!current)
  const [value, setValue] = useState(current)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()

  useEffect(() => {
    setValue(current)
    if (current) setOpen(true)
  }, [current])

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => toggleRef.current?.focus())
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(value)
  }

  return (
    <form
      ref={formRef}
      role="search"
      onSubmit={onSubmit}
      className="relative flex items-center"
      onBlur={(e) => {
        if (!value && !formRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          close(true)
        }
      }}
    >
      {open ? (
        <>
          <label htmlFor={id} className="sr-only">
            Buscar NFTs e coleções
          </label>
          <input
            ref={inputRef}
            id={id}
            type="search"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Buscar NFTs…"
            className="mr-2 h-9 w-44 rounded-md border border-border bg-card px-3 text-body text-foreground placeholder:text-sand focus-visible:border-primary focus-visible:outline-none lg:w-56 [&::-webkit-search-cancel-button]:hidden"
            data-testid="search-input"
          />
          <button type="submit" className="grid size-9 place-items-center rounded-md text-foreground hover:text-text-accent" aria-label="Buscar">
            <SearchIcon width={20} height={20} />
          </button>
        </>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          className="grid size-9 place-items-center rounded-md text-foreground hover:text-text-accent"
          aria-label="Abrir busca"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          data-testid="search-toggle"
        >
          <SearchIcon width={20} height={20} />
        </button>
      )}
    </form>
  )
}
