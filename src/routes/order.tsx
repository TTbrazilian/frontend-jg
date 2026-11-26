import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Container } from '@/components/layout/container'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { MobileScreenHeader } from '@/features/cart/components/mobile-screen-header'
import { useOrder, useOrderTerminalEffects } from '@/features/orders/hooks'
import { OrderReceipt } from '@/features/orders/components/order-receipt'
import { OrderDeclined, OrderError, OrderNotFound, OrderPending, OrderSkeleton } from '@/features/orders/components/order-states'
import { useRealtime } from '@/realtime/realtime-provider'

const route = getRouteApi('/pedido/$orderId')

/**
 * Status do pedido. `pending` é seguro para recarregar (o pedido vive no servidor; socket + polling
 * atualizam). O recibo só aparece quando o SERVIDOR confirma o pedido.
 */
export function OrderPage() {
  const { orderId } = route.useParams()
  const order = useOrder(orderId)
  const data = order.data
  useOrderTerminalEffects(data)
  const { socket, status: socketStatus } = useRealtime()
  const [receiptDismissed, setReceiptDismissed] = useState(false)

  // Pede ao servidor o estado atual do pedido pelo socket (também após reconectar).
  const pending = data?.status === 'pending'
  useEffect(() => {
    if (!socket || socketStatus !== 'connected' || !pending) return
    socket.emit('order.watch', { orderId })
  }, [socket, socketStatus, pending, orderId])

  useEffect(() => {
    document.title = data?.status === 'confirmed' ? 'Pedido confirmado · Kurio' : data?.status === 'declined' ? 'Pagamento recusado · Kurio' : 'Pedido · Kurio'
  }, [data?.status])

  const error = order.error ? toApiError(order.error) : null
  const notFound = !data && error && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')

  let body: React.ReactNode
  if (data?.status === 'confirmed') {
    const receiptOpen = !receiptDismissed
    body = (
      <>
        <Dialog open={receiptOpen} onOpenChange={(open) => !open && setReceiptDismissed(true)}>
          <DialogContent
            className="max-w-[578px] gap-0 border-b-[10px]"
            closeLabel="Fechar recibo"
            onCloseAutoFocus={(e) => {
              // O recibo continua na página: o foco vai para o título dele.
              e.preventDefault()
              window.setTimeout(() => document.getElementById('receipt-page-title')?.focus(), 0)
            }}
            data-testid="order-confirmed"
          >
            <DialogDescription className="sr-only">
              Pagamento confirmado. Recibo da compra com o resumo da transação.
            </DialogDescription>
            <OrderReceipt order={data} titleId="receipt-dialog-title" renderTitle={(p) => <DialogTitle {...p} />} />
          </DialogContent>
        </Dialog>
        {receiptOpen ? (
          <p className="sr-only">Pagamento confirmado.</p>
        ) : (
          <article
            aria-labelledby="receipt-page-title"
            className="mx-auto w-full max-w-[578px] border-b-[10px] border-primary bg-card shadow-overlay"
            data-testid="order-confirmed"
          >
            <OrderReceipt
              order={data}
              titleId="receipt-page-title"
              renderTitle={({ children, ...p }) => (
                <h2 {...p} tabIndex={-1}>
                  {children}
                </h2>
              )}
            />
          </article>
        )}
      </>
    )
  } else if (data?.status === 'declined') {
    body = <OrderDeclined order={data} />
  } else if (data) {
    body = <OrderPending order={data} />
  } else if (notFound) {
    body = <OrderNotFound />
  } else if (error) {
    body = <OrderError message={error.message} onRetry={() => void order.refetch()} retrying={order.isFetching} />
  } else {
    body = <OrderSkeleton />
  }

  return (
    <Container className="flex flex-col gap-6 pb-16 pt-6 md:gap-8 md:pt-8">
      <div className="max-md:hidden">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Carrinho', to: '/carrinho' }, { label: 'Pedido' }]} />
      </div>
      <MobileScreenHeader title="Seu pedido" backTo="/" backLabel="Voltar ao início" />
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">{body}</div>
    </Container>
  )
}
