import { useEffect, useId, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Big from 'big.js'
import { toast } from 'sonner'
import { MOCK_SCENARIOS, type MockScenario, type MockState } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { http } from '@/api/http'
import { sessionStore } from '@/app/session-store'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCart } from '@/features/cart/hooks'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { announce } from './live-region'


const SCENARIO_LABELS: Record<MockScenario, string> = {
  default: 'Padrão',
  'empty-catalog': 'Catálogo vazio',
  'slow-network': 'Rede lenta (2,5 s)',
  'variable-latency': 'Latência variável (busca)',
  offline: 'Sem conexão',
  'server-error': 'Erro no servidor (catálogo)',
  'session-expired': 'Sessão expirada',
  unauthorized: 'Acesso negado (403)',
  'favorites-failure': 'Falha nos favoritos',
  'price-change-on-checkout': 'Preço muda no checkout',
  'sold-out-on-checkout': 'Esgota no checkout',
  'order-timeout': 'Timeout ao criar pedido',
  'payment-declined': 'Pagamento recusado',
  'wallet-rejected': 'Carteira recusa conexão',
}

/**
 * Painel de simulação (somente com mocks ativos). Todas as ações passam pela API do mock
 * (`/api/__mock/*` via Axios) — o servidor simulado emite os eventos pelo Socket.IO e a
 * interface reage como reagiria a um backend real. Nunca altera o cache do app diretamente.
 */
export function MockPanel() {
  const queryClient = useQueryClient()
  const cart = useCart()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MockState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string>('')
  const scenarioId = useId()
  const itemSelectId = useId()

  const items = cart.data?.items ?? []
  const item = items.find((i) => i.id === itemId) ?? items[0]

  useEffect(() => {
    if (!open) return
    let alive = true
    api.mock
      .state()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState(null))
    return () => {
      alive = false
    }
  }, [open])

  const run = async (label: string, action: () => Promise<unknown>, success: string) => {
    setBusy(label)
    try {
      await action()
      toast.info(success, { id: 'mock-panel' })
      announce(success)
    } catch (err) {
      toast.error(`Simulação: ${toApiError(err).message}`, { id: 'mock-panel' })
    } finally {
      setBusy(null)
    }
  }

  const onScenario = (value: string) => {
    const scenario = value as MockScenario
    void run(
      'scenario',
      async () => setState(await api.mock.setScenario(scenario)),
      `Cenário ativo: ${SCENARIO_LABELS[scenario]}.`,
    )
  }

  const onReset = async () => {
    setBusy('reset')
    try {
      await api.mock.reset()
    } catch (err) {
      toast.error(`Simulação: ${toApiError(err).message}`)
      setBusy(null)
      return
    }
    queryClient.clear()
    sessionStore.signOut()
    window.location.reload()
  }

  const priceUp = () => {
    if (!item) return
    const priceEth = new Big(item.unitPriceEth).times('1.1').round(6, Big.roundHalfEven).toFixed()
    void run(
      'price',
      () => http.post('/__mock/nft-update', { nftId: item.nftId, editionId: item.editionId, priceEth }),
      `Preço de ${item.title} (${item.editionLabel}) alterado para ${formatEth(priceEth)} no servidor.`,
    )
  }

  const soldOut = () => {
    if (!item) return
    void run(
      'stock',
      () => http.post('/__mock/nft-update', { nftId: item.nftId, editionId: item.editionId, available: 0 }),
      `Estoque de ${item.title} (${item.editionLabel}) zerado no servidor.`,
    )
  }

  // Mobile: aba lateral no meio da borda esquerda, para nunca cobrir a tab bar nem barras fixas de compra.
  const mobileOffset =
    'max-md:bottom-auto max-md:top-1/2 max-md:left-0 max-md:-translate-y-1/2 max-md:h-auto max-md:rounded-l-none max-md:px-1.5 max-md:py-3 max-md:[writing-mode:vertical-rl]'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'fixed bottom-4 left-4 z-40 flex h-9 items-center gap-2 rounded-pill border border-border-soft bg-surface-dark/95 px-3 text-caption font-bold text-text-secondary shadow-overlay',
            'transition-colors hover:text-text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            mobileOffset,
          )}
          data-testid="mock-panel-trigger"
          aria-label="Abrir painel de simulação (ferramenta de demonstração)"
        >
          <span aria-hidden className="size-2 rounded-full bg-amber" />
          Simulação
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="gap-6" aria-describedby={undefined} data-testid="mock-panel">
        <div className="flex flex-col gap-1 pr-8">
          <p className="text-tiny font-bold uppercase tracking-widest text-amber">Ferramenta de demonstração</p>
          <SheetTitle>Painel de simulação</SheetTitle>
          <SheetDescription className="text-caption">
            Controla o servidor simulado (MSW). Os efeitos chegam à interface pela API e pelo Socket.IO.
          </SheetDescription>
        </div>

        <section className="flex flex-col gap-2" aria-labelledby={`${scenarioId}-label`}>
          <h3 id={`${scenarioId}-label`} className="text-body font-bold">
            Cenário
          </h3>
          <p className="text-caption text-text-secondary" data-testid="mock-current-scenario">
            Atual: <span className="font-bold text-foreground">{state ? SCENARIO_LABELS[state.scenario] : '—'}</span>
          </p>
          <Select value={state?.scenario} onValueChange={onScenario} disabled={busy !== null}>
            <SelectTrigger id={scenarioId} aria-labelledby={`${scenarioId}-label`} data-testid="mock-scenario-select">
              <SelectValue placeholder="Selecione um cenário" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_SCENARIOS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SCENARIO_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="flex flex-col gap-2" aria-labelledby={`${itemSelectId}-label`}>
          <h3 id={`${itemSelectId}-label`} className="text-body font-bold">
            Item do carrinho
          </h3>
          {items.length === 0 ? (
            <p className="text-caption text-text-secondary">Adicione um NFT ao carrinho para simular mudanças de preço e estoque.</p>
          ) : (
            <>
              <Select value={item?.id} onValueChange={setItemId}>
                <SelectTrigger aria-labelledby={`${itemSelectId}-label`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title} ({i.editionLabel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={priceUp} loading={busy === 'price'} disabled={busy !== null} data-testid="mock-price-up">
                  Preço +10%
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={soldOut} loading={busy === 'stock'} disabled={busy !== null} data-testid="mock-sold-out">
                  Zerar estoque
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="mock-events-title">
          <h3 id="mock-events-title" className="text-body font-bold">
            Tempo real e sessão
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              loading={busy === 'dup'}
              onClick={() => void run('dup', () => http.post('/__mock/emit-duplicate', {}), 'Último evento reenviado (duplicado).')}
              data-testid="mock-emit-duplicate"
            >
              Reenviar evento duplicado
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy !== null || !item}
              loading={busy === 'stale'}
              onClick={() => item && void run('stale', () => http.post('/__mock/emit-stale', { nftId: item.nftId }), 'Evento antigo (fora de ordem) emitido.')}
              data-testid="mock-emit-stale"
            >
              Emitir evento antigo
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              loading={busy === 'disconnect'}
              onClick={() => void run('disconnect', () => http.post('/__mock/socket/disconnect'), 'Socket derrubado pelo servidor; reconectando.')}
              data-testid="mock-socket-disconnect"
            >
              Derrubar conexão em tempo real
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              loading={busy === 'expire'}
              onClick={() => void run('expire', () => http.post('/__mock/sessions/expire'), 'Sessões revogadas no servidor.')}
              data-testid="mock-expire-sessions"
            >
              Expirar sessão
            </Button>
          </div>
        </section>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <Button type="button" variant="destructive" size="sm" onClick={() => void onReset()} loading={busy === 'reset'} disabled={busy !== null} data-testid="mock-reset">
            Restaurar dados e sair
          </Button>
          <p className="text-caption text-text-secondary">Restaura o seed, encerra a sessão e recarrega a página.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
