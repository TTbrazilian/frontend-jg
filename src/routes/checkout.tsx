import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm, useWatch } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CollectorInfo, CreateOrderRequest, NetworkId, Quote, Wallet } from '@/api/contracts'
import { NETWORKS } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { useSession } from '@/app/session-store'
import { ChevronDownIcon } from '@/components/icons'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Container } from '@/components/layout/container'
import { announce } from '@/components/layout/live-region'
import { useIsDesktop } from '@/components/layout/use-media-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FormAlert } from '@/features/account/form-alert'
import { useScope } from '@/features/auth/use-scope'
import { CartIssuesBanner } from '@/features/cart/components/cart-issues-banner'
import { EthValue } from '@/features/cart/components/quote-totals'
import { MobileScreenHeader } from '@/features/cart/components/mobile-screen-header'
import { useAcknowledgeCart, useCart, useQuote } from '@/features/cart/hooks'
import { checkoutResolver, firstInvalidField, formFieldFromApiKey, type CollectorOutput } from '@/features/checkout/checkout-form'
import { CheckoutSummary } from '@/features/checkout/components/checkout-summary'
import { CollectorFields } from '@/features/checkout/components/collector-fields'
import { ReviewDialog, type ReviewPhase, type ReviewState } from '@/features/checkout/components/review-dialog'
import { NoWalletsNotice, WalletSelector, type WalletConnectionState } from '@/features/checkout/components/wallet-selector'
import { WalletTypeCards } from '@/features/checkout/components/wallet-type-cards'
import { clearCheckoutDraft, readCheckoutDraft, writeCheckoutDraft } from '@/features/checkout/draft'
import { diffQuotes, sameQuoteValues } from '@/features/checkout/quote-diff'
import { EMPTY_VALUES, FIELD_ORDER, LOCKED_WALLET_FIELDS, prefillValues, toCollector, walletFields, type CheckoutFieldName, type CheckoutFormValues } from '@/features/checkout/schema'
import { usePendingOrder } from '@/features/checkout/use-pending-order'
import { QuoteChangedError, useCreateOrder } from '@/features/orders/hooks'
import { useProfile } from '@/features/profile/hooks'
import { useConnectWallet, useDisconnectWallet, useWallets } from '@/features/wallets/hooks'
import { cn } from '@/lib/utils'

/** Tempo após o qual a criação do pedido é tratada como "verificando status" (= timeout do POST /orders). */
const ORDER_CHECKING_AFTER_MS = 6_000

const isNetwork = (v: unknown): v is NetworkId => typeof v === 'string' && (NETWORKS as readonly string[]).includes(v)

function pickDefaultWallet(wallets: Wallet[], preferredId: string | null): Wallet | undefined {
  return wallets.find((w) => w.id === preferredId) ?? wallets.find((w) => w.role === 'primary') ?? wallets[0]
}

/** Foca o controle do campo (input, gatilho do select ou 1º radio do grupo). */
function focusField(name: CheckoutFieldName) {
  const el = document.querySelector<HTMLElement>(`[data-testid="field-${name}"]`)
  if (!el) return
  const target = el.getAttribute('role') === 'radiogroup' ? (el.querySelector<HTMLElement>('[role="radio"][data-state="checked"]') ?? el.querySelector<HTMLElement>('[role="radio"]')) : el
  target?.focus()
  target?.scrollIntoView({ block: 'center' })
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const { scope } = useScope()
  const userId = session.user?.id ?? null
  const isDesktop = useIsDesktop()
  const expired = session.status === 'expired'

  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()
  const pending = usePendingOrder()
  const createOrder = useCreateOrder()
  const acknowledge = useAcknowledgeCart()
  const connectWallet = useConnectWallet()
  const disconnectWallet = useDisconnectWallet()

  const walletList = useMemo(() => wallets.data?.items ?? [], [wallets.data])
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
  const selectedWallet = walletList.find((w) => w.id === selectedWalletId)

  const form = useForm<CheckoutFormValues, unknown, CollectorOutput>({
    resolver: checkoutResolver,
    defaultValues: EMPTY_VALUES,
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const { setValue, reset, getFieldState, handleSubmit, setError, getValues, control, subscribe } = form
  const useOtherWallet = useWatch({ control, name: 'useOtherWallet' })
  const formNetwork = useWatch({ control, name: 'network' })
  const locked = !useOtherWallet && !!selectedWallet

  // Rede da cotação = rede do formulário (válida) → senão a da carteira → Ethereum.
  const network: NetworkId = isNetwork(formNetwork) ? formNetwork : (selectedWallet?.network ?? 'ethereum')
  const quote = useQuote(network)
  const currentQuote = quote.data && !quote.isPlaceholderData ? quote.data : undefined

  // ---- Inicialização: rascunho da sessão > perfil + carteira cadastrada. Uma única vez. ----
  const initialized = useRef(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (initialized.current || !userId) return
    const draft = readCheckoutDraft(userId)
    if (draft) {
      initialized.current = true
      reset(draft.values)
      setSelectedWalletId(draft.walletId)
      setReady(true)
      return
    }
    if (wallets.isPending && !wallets.isError) return
    if (profile.isPending && !profile.isError && !session.user) return
    initialized.current = true
    const wallet = pickDefaultWallet(walletList, null)
    reset(prefillValues(profile.data ?? session.user ?? undefined, wallet))
    setSelectedWalletId(wallet?.id ?? null)
    setReady(true)
  }, [userId, wallets.isPending, wallets.isError, profile.isPending, profile.isError, profile.data, walletList, session.user, reset])

  // Rascunho de outra carteira que não existe mais → cai na padrão.
  useEffect(() => {
    if (!ready || !wallets.data) return
    if (!selectedWalletId || !walletList.some((w) => w.id === selectedWalletId)) {
      setSelectedWalletId(pickDefaultWallet(walletList, null)?.id ?? null)
    }
  }, [ready, wallets.data, walletList, selectedWalletId])

  // Campos travados acompanham a carteira selecionada (a não ser que "Usar outra carteira?" esteja marcado).
  useEffect(() => {
    if (!ready || !selectedWallet || useOtherWallet) return
    const fields = walletFields(selectedWallet)
    for (const key of LOCKED_WALLET_FIELDS) {
      if (getValues(key) !== fields[key]) setValue(key, fields[key] as never, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })
    }
  }, [ready, selectedWallet, useOtherWallet, getValues, setValue, form.formState.isSubmitted])

  // Rascunho em sessionStorage (nunca senha). Não é apagado quando a sessão expira.
  useEffect(() => {
    if (!ready || !userId) return
    writeCheckoutDraft(userId, { values: getValues(), walletId: selectedWalletId })
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => writeCheckoutDraft(userId, { values: { ...EMPTY_VALUES, ...values }, walletId: selectedWalletId }),
    })
  }, [ready, userId, subscribe, getValues, selectedWalletId])

  // ---- Conexão da carteira (simulada pela API) ----
  const [connection, setConnection] = useState<WalletConnectionState>({ walletId: null, status: 'idle' })
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedWalletId

  const onSelectWallet = (id: string) => {
    if (id === selectedWalletId) return
    const wallet = walletList.find((w) => w.id === id)
    if (connection.status === 'connected' && connection.walletId) disconnectWallet.mutate(connection.walletId)
    setConnection({ walletId: null, status: 'idle' })
    setSelectedWalletId(id)
    // Dados complementares da carteira entram só nos campos que o usuário não editou.
    if (wallet) {
      const fields = walletFields(wallet)
      for (const [key, value] of Object.entries(fields) as [keyof CheckoutFormValues, string][]) {
        if ((LOCKED_WALLET_FIELDS as readonly string[]).includes(key)) continue
        if (!getFieldState(key).isDirty) setValue(key, value as never)
      }
      announce(`Carteira ${wallet.nickname} selecionada. Conecte-a para confirmar.`)
    }
  }

  const onConnect = () => {
    if (!selectedWallet) return
    const wallet = selectedWallet
    setConnection({ walletId: wallet.id, status: 'connecting' })
    announce(`Conectando à carteira ${wallet.nickname}…`)
    connectWallet.mutate(
      { id: wallet.id, network: wallet.network },
      {
        onSuccess: () => {
          if (selectedRef.current !== wallet.id) return
          setConnection({ walletId: wallet.id, status: 'connected' })
          const msg = `Carteira ${wallet.nickname} conectada.`
          toast.success(msg, { id: 'wallet-connection' })
          announce(msg)
        },
        onError: (err) => {
          if (selectedRef.current !== wallet.id) return
          const e = toApiError(err)
          setConnection({ walletId: wallet.id, status: e.code === 'WALLET_REJECTED' ? 'rejected' : 'error', message: e.message })
        },
      },
    )
  }

  const onDisconnect = () => {
    const id = connection.walletId
    if (!id) return
    disconnectWallet.mutate(id, {
      onSettled: () => {
        setConnection({ walletId: null, status: 'idle' })
        announce('Carteira desconectada.')
      },
    })
  }

  const connected = connection.status === 'connected' && connection.walletId === selectedWalletId && !!selectedWalletId

  // ---- Bloqueios da confirmação (com motivo visível) ----
  const items = cart.data?.items ?? []
  const hasItemIssues = items.some((i) => i.status !== 'ok')
  let blockedReason: string | null = null
  if (expired) blockedReason = 'Sua sessão expirou. Entre novamente para continuar — seus dados foram mantidos.'
  else if (pending.isPending) blockedReason = 'Você já tem um pedido em processamento. Aguarde a conclusão para fazer uma nova compra.'
  else if (pending.isChecking) blockedReason = 'Verificando pedidos em andamento…'
  else if (cart.data && items.length === 0) blockedReason = 'Seu carrinho está vazio.'
  else if (wallets.data && walletList.length === 0) blockedReason = 'Cadastre uma carteira para continuar.'
  else if (hasItemIssues || currentQuote?.purchasable === false) blockedReason = 'Revise e aceite as alterações dos itens antes de confirmar.'
  else if (!currentQuote) blockedReason = quote.isError ? 'Não foi possível calcular os valores.' : 'Calculando os valores do pedido…'
  else if (!connected) blockedReason = 'Conecte a carteira selecionada para confirmar a compra.'

  // ---- Revisão → revalidação → criação do pedido ----
  const [reviewOpen, setReviewOpen] = useState(false)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [phase, setPhase] = useState<ReviewPhase>('idle')
  const [checking, setChecking] = useState(false)
  const [collector, setCollector] = useState<CollectorInfo | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [accordionOpen, setAccordionOpen] = useState(false)
  const busyRef = useRef(false)

  const fetchFreshQuote = useCallback(async (): Promise<Quote> => {
    const fresh = await api.quotes.create({ network })
    queryClient.setQueryData(qk.quote(scope, fresh.cartVersion, network), fresh)
    return fresh
  }, [network, queryClient, scope])

  const onValid = async (values: CollectorOutput) => {
    setFormError(null)
    setCollector(toCollector(values))
    let base = currentQuote
    if (!base) {
      try {
        base = await fetchFreshQuote()
      } catch (err) {
        setFormError(toApiError(err).message)
        return
      }
    }
    setReview({ quote: base, changes: [] })
    setPhase('idle')
    setReviewOpen(true)
  }

  const onInvalid = (errors: Partial<Record<CheckoutFieldName, unknown>>) => {
    const first = firstInvalidField(errors)
    if (!first) return
    if (!isDesktop && first !== 'walletType') setAccordionOpen(true)
    const count = FIELD_ORDER.filter((f) => errors[f]).length
    announce(`${count === 1 ? 'Há 1 campo' : `Há ${count} campos`} com erro no formulário.`, 'assertive')
    // Após o render (o acordeão mobile precisa abrir antes de focar).
    window.setTimeout(() => focusField(first), 0)
  }

  const onConfirmClick = () => {
    if (blockedReason) {
      announce(blockedReason, 'assertive')
      return
    }
    void handleSubmit(onValid, onInvalid)()
  }

  const applyServerFieldErrors = (error: ApiError): boolean => {
    let first: CheckoutFieldName | null = null
    for (const [key, message] of Object.entries(error.fieldErrors)) {
      const field = formFieldFromApiKey(key)
      if (!field) continue
      setError(field, { type: 'server', message })
      if (!first || FIELD_ORDER.indexOf(field) < FIELD_ORDER.indexOf(first)) first = field
    }
    if (!first) return false
    const target = first
    setReviewOpen(false)
    if (!isDesktop && target !== 'walletType') setAccordionOpen(true)
    window.setTimeout(() => focusField(target), 50)
    return true
  }

  const onReviewConfirm = async () => {
    if (!review || !selectedWallet || !collector || busyRef.current) return
    busyRef.current = true
    const reviewed = review.quote
    try {
      let fresh: Quote
      if (reviewed.issues.length > 0) {
        // 1) Cotação com pendências (preço mudou/estoque): o usuário viu os novos valores e aceitou.
        //    Aceita no servidor e só segue direto se a nova cotação tiver exatamente os valores exibidos.
        setPhase('acknowledging')
        await acknowledge.mutateAsync()
        fresh = await fetchFreshQuote()
        if (!fresh.purchasable || !sameQuoteValues(reviewed, fresh)) {
          const changes = diffQuotes(reviewed, fresh)
          setReview({ quote: fresh, changes, notice: 'Alterações aceitas. Confira os valores atualizados e confirme a compra.' })
          announce('Alterações aceitas. Confira os valores atualizados e confirme a compra.', 'assertive')
          return
        }
      } else {
        // 2) Revalida: nova cotação e comparação do fingerprint.
        setPhase('revalidating')
        fresh = await fetchFreshQuote()
        if (fresh.fingerprint !== reviewed.fingerprint || !fresh.purchasable) {
          const changes = diffQuotes(reviewed, fresh)
          setReview({ quote: fresh, changes })
          announce(`A cotação mudou: ${changes.join(' ')} Confirme novamente.`, 'assertive')
          return
        }
      }

      // 3) Cria o pedido (idempotente; reenvio automático em timeout com a mesma chave).
      setPhase('submitting')
      const timer = window.setTimeout(() => {
        setChecking(true)
        announce('Verificando o status do pedido…')
      }, ORDER_CHECKING_AFTER_MS)
      const body: CreateOrderRequest = {
        quoteId: fresh.id,
        quoteFingerprint: fresh.fingerprint,
        walletId: selectedWallet.id,
        network,
        collector,
      }
      try {
        const order = await createOrder.submit(body)
        if (!order) return
        if (userId) clearCheckoutDraft(userId)
        announce('Pedido criado. Aguardando a confirmação do pagamento.')
        setReviewOpen(false)
        void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
      } finally {
        window.clearTimeout(timer)
        setChecking(false)
      }
    } catch (err) {
      if (err instanceof QuoteChangedError) {
        const changes = diffQuotes(reviewed, err.quote)
        setReview({ quote: err.quote, changes, notice: err.message })
        announce(`${err.message} Revise e confirme novamente.`, 'assertive')
        return
      }
      const e = toApiError(err)
      if (e.code === 'VALIDATION_ERROR' && applyServerFieldErrors(e)) {
        announce('Corrija os campos indicados.', 'assertive')
        return
      }
      const message =
        e.code === 'TIMEOUT' || e.code === 'NETWORK_ERROR'
          ? 'Não conseguimos confirmar o status do pedido. Tente novamente: a mesma solicitação será reenviada e não criará um pedido duplicado.'
          : e.message
      setReview((r) => (r ? { ...r, error: message } : r))
      announce(message, 'assertive')
    } finally {
      busyRef.current = false
      setPhase('idle')
    }
  }

  const onReviewOpenChange = (open: boolean) => {
    setReviewOpen(open)
    if (!open) setReview(null)
  }

  useEffect(() => {
    document.title = 'Pagamento · Kurio'
  }, [])

  // ---- Render ----
  const loadingPage = !ready || (wallets.isPending && !wallets.isError)
  const summaryProps = {
    cart: cart.data,
    quote: quote.data,
    loading: quote.isPending,
    recalculating: quote.isFetching && !!quote.data,
    error: quote.isError,
    onRetry: () => void quote.refetch(),
  }

  const walletSection = (variant: 'desktop' | 'mobile') =>
    wallets.isError && !wallets.data ? (
      <FormAlert action={<Button type="button" variant="link" size="sm" onClick={() => void wallets.refetch()}>Tentar novamente</Button>}>
        Não foi possível carregar suas carteiras.
      </FormAlert>
    ) : walletList.length === 0 && wallets.data ? (
      <NoWalletsNotice />
    ) : wallets.data ? (
      <WalletSelector
        wallets={walletList}
        selectedId={selectedWalletId}
        onSelect={onSelectWallet}
        connection={connection}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        disconnecting={disconnectWallet.isPending}
        variant={variant}
        labelledBy={variant === 'desktop' ? 'wallet-section-title' : 'wallet-section-title-mobile'}
        disabled={phase !== 'idle'}
      />
    ) : (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-[45px] w-full" />
        <Skeleton className="h-[45px] w-full" />
      </div>
    )

  const reasonId = 'confirm-purchase-reason'
  const confirmButton = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={onConfirmClick}
        aria-disabled={blockedReason ? true : undefined}
        aria-describedby={blockedReason ? reasonId : undefined}
        loading={phase !== 'idle' && !reviewOpen}
        className={cn(
          'h-[45px] w-full rounded-lg text-body-md',
          'max-md:h-[60px] max-md:rounded-pill max-md:bg-gradient-to-r max-md:from-primary max-md:to-primary/80',
        )}
        data-testid="confirm-purchase"
      >
        Confirmar compra
      </Button>
      {blockedReason ? (
        <p id={reasonId} className="text-center text-caption text-text-secondary" data-testid="confirm-purchase-reason">
          {blockedReason}
        </p>
      ) : null}
    </div>
  )

  const alerts = (
    <>
      {pending.isPending && pending.orderId ? (
        <FormAlert
          data-testid="checkout-pending-order"
          action={
            <Link to="/pedido/$orderId" params={{ orderId: pending.orderId }} className="font-bold text-text-accent underline-offset-4 hover:underline">
              Acompanhar pedido
            </Link>
          }
        >
          Você tem um pedido em processamento. Uma nova compra fica bloqueada até ele ser concluído.
        </FormAlert>
      ) : null}
      {cart.data && items.length === 0 && !pending.isPending ? (
        <FormAlert
          action={
            <Link to="/" className="font-bold text-text-accent underline-offset-4 hover:underline">
              Explorar o catálogo
            </Link>
          }
        >
          Seu carrinho está vazio.
        </FormAlert>
      ) : null}
      {hasItemIssues ? <CartIssuesBanner items={items} /> : null}
      {formError ? <FormAlert>{formError}</FormAlert> : null}
    </>
  )

  const fields = <CollectorFields form={form} locked={locked} showWalletType={isDesktop} />

  return (
    <Container className="flex flex-col gap-6 pb-16 pt-6 md:gap-8 md:pt-8" data-testid="checkout-page">
      <div className="max-md:hidden">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Pagamento' }]} />
      </div>
      <MobileScreenHeader title="Pagamento com carteira" backTo="/carrinho" backLabel="Voltar ao carrinho" />

      {alerts}

      {loadingPage ? (
        <CheckoutSkeleton />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onConfirmClick()
          }}
          data-testid="checkout-form"
          aria-label="Pagamento"
          className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between"
        >
          {isDesktop ? (
            <>
              <section aria-labelledby="collector-title" className="flex min-w-0 flex-col gap-3">
                <h2 id="collector-title" className="text-[1.0625rem] font-bold leading-4">
                  Perfil do colecionador
                </h2>
                {fields}
              </section>

              <aside aria-labelledby="summary-title" className="flex min-w-0 flex-col gap-3">
                <h2 id="summary-title" className="text-[1.0625rem] font-bold leading-4">
                  Seus NFTs
                </h2>
                <CheckoutSummary {...summaryProps} />
                <section aria-labelledby="wallet-section-title" className="mt-3 flex flex-col gap-5">
                  <h2 id="wallet-section-title" className="text-center text-[1.0625rem] font-bold leading-4">
                    Carteira e rede
                  </h2>
                  {walletSection('desktop')}
                </section>
                <div className="mt-3">{confirmButton}</div>
              </aside>
            </>
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              <section aria-labelledby="wallet-section-title-mobile" className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="wallet-section-title-mobile" className="text-body-lg font-bold leading-4">
                    Carteira conectada
                  </h2>
                  <Link to="/perfil/carteiras" className="text-body font-bold text-text-accent underline-offset-4 hover:underline">
                    Trocar carteira
                  </Link>
                </div>
                {walletSection('mobile')}
              </section>

              <section aria-labelledby="wallet-type-title" className="flex flex-col gap-4">
                <h2 id="wallet-type-title" className="text-body-lg font-bold leading-4">
                  Carteira e rede
                </h2>
                <WalletTypeCards form={form} locked={locked} labelledBy="wallet-type-title" />
              </section>

              <MobileAccordion id="collector" title="Dados do colecionador" open={accordionOpen} onOpenChange={setAccordionOpen} invalid={Object.keys(form.formState.errors).some((k) => k !== 'walletType')}>
                {fields}
              </MobileAccordion>

              <MobileAccordion id="summary" title="Resumo do pedido" defaultOpen={false}>
                <CheckoutSummary {...summaryProps} />
              </MobileAccordion>

              <p className="flex items-baseline justify-end gap-7 text-body-lg font-bold" aria-live="polite">
                Total:
                {quote.data ? <EthValue value={quote.data.totalEth} className="text-title-sm text-text-accent" /> : <Skeleton className="h-4 w-24" />}
              </p>

              <div className="sticky bottom-0 z-20 -mx-6 bg-gradient-to-t from-background via-background to-background/0 px-6 pb-6 pt-4">{confirmButton}</div>
            </div>
          )}
        </form>
      )}

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={onReviewOpenChange}
        review={review}
        phase={phase}
        checking={checking}
        wallet={selectedWallet}
        collector={collector}
        onConfirm={() => void onReviewConfirm()}
      />
    </Container>
  )
}

/** Accordion acessível (botão com aria-expanded/aria-controls); no mobile os dados ficam recolhidos. */
function MobileAccordion({
  id,
  title,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  invalid,
  children,
}: {
  id: string
  title: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  invalid?: boolean
  children: React.ReactNode
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolled
  const setOpen = onOpenChange ?? setUncontrolled
  const panelId = `${id}-panel`
  const buttonId = `${id}-trigger`
  return (
    <section className="rounded-[14px] bg-card shadow-overlay">
      <h2 className="text-body-lg font-bold">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[14px] px-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex items-center gap-2">
            {title}
            {invalid ? (
              <span className="rounded-xs bg-destructive/15 px-1.5 py-0.5 text-tiny font-bold text-destructive">
                Revisar<span className="sr-only"> — há campos com erro</span>
              </span>
            ) : null}
          </span>
          <ChevronDownIcon width={18} height={18} aria-hidden className={cn('text-sand transition-transform', open && 'rotate-180')} />
        </button>
      </h2>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="px-4 pb-5">
        {children}
      </div>
    </section>
  )
}

function CheckoutSkeleton() {
  return (
    <div role="status" aria-label="Carregando pagamento" className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-56" />
        <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-full rounded-xs" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-[45px] w-full" />
      </div>
    </div>
  )
}

