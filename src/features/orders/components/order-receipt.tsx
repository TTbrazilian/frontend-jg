import type { NetworkId, Order } from '@/api/contracts'
import { NETWORK_LABELS, WALLET_PROVIDER_LABELS } from '@/api/contracts'
import { ThankYouIcon } from '@/components/icons'
import { NftImage } from '@/components/nft/nft-image'
import { buttonVariants } from '@/components/ui/button'
import { EthValue } from '@/features/cart/components/quote-totals'
import { compareEth } from '@/lib/money'
import { cn, shortAddress } from '@/lib/utils'

export const EXPLORER_LABELS: Record<NetworkId, string> = {
  ethereum: 'Etherscan',
  polygon: 'Polygonscan',
  solana: 'Solana Explorer',
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "29 Jul, 2026" como no Figma (meses em pt-BR). */
export function formatReceiptDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

interface OrderReceiptProps {
  order: Order
  /** id do título (para aria-labelledby do diálogo/página). */
  titleId: string
  /** Título renderizado (DialogTitle no modal, h1 na página). */
  renderTitle: (props: { id: string; className: string; children: string }) => React.ReactNode
}

/**
 * Recibo do pedido confirmado (`desktop-confirmacao-de-pedido`). Todos os valores vêm do
 * SNAPSHOT do pedido (linhas, totais, carteira e rede no momento da compra), nunca do carrinho.
 */
export function OrderReceipt({ order, titleId, renderTitle }: OrderReceiptProps) {
  const explorer = EXPLORER_LABELS[order.network]
  const hasDiscount = compareEth(order.discountEth, '0') > 0
  const provider = WALLET_PROVIDER_LABELS[order.wallet.provider]

  return (
    <div className="flex flex-col">
      <header className="flex flex-col items-center gap-4 px-6 pb-[22px] pt-[22px] text-center">
        <ThankYouIcon width={80} height={80} className="text-primary" aria-hidden />
        {renderTitle({ id: titleId, className: 'text-body-lg font-bold leading-4 text-text-secondary', children: 'Seus NFTs agora estão na sua carteira' })}
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-primary px-6 py-4 text-text-secondary sm:flex sm:items-center sm:justify-between sm:px-9 sm:py-[15px]">
        <MetaItem label="ID da transação" strong>
          {order.txHash ? (
            <span title={order.txHash} data-testid="receipt-tx">
              {shortAddress(order.txHash, 4)}
              <span className="sr-only"> (hash completo: {order.txHash})</span>
            </span>
          ) : (
            <span data-testid="receipt-tx">—</span>
          )}
        </MetaItem>
        <MetaDivider />
        <MetaItem label="Data">
          <time dateTime={order.updatedAt}>{formatReceiptDate(order.updatedAt)}</time>
        </MetaItem>
        <MetaDivider />
        <MetaItem label="Total">
          <EthValue value={order.totalEth} />
        </MetaItem>
        <MetaDivider />
        <MetaItem label="Carteira" strong>
          <span title={order.wallet.address}>{provider}</span>
        </MetaItem>
      </dl>

      <section aria-labelledby={`${titleId}-details`} className="flex flex-col gap-3 px-6 pb-12 pt-5 sm:px-11">
        <h3 id={`${titleId}-details`} className="text-body-md font-bold leading-4">
          Detalhes da transação
        </h3>
        <table className="w-full table-fixed border-separate border-spacing-y-3">
          <caption className="sr-only">NFTs comprados</caption>
          <colgroup>
            <col />
            <col className="w-[72px] sm:w-[90px]" />
            <col className="w-[96px] sm:w-[120px]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="border-b border-primary/40 pb-3 text-left text-body-lg font-bold leading-4">
                NFTs
              </th>
              <th scope="col" className="border-b border-primary/40 pb-3 text-center text-body-lg font-bold leading-4">
                Edições
              </th>
              <th scope="col" className="border-b border-primary/40 pb-3 text-right text-body-lg font-medium leading-4">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId} className="bg-card" data-testid="receipt-line">
                <td className="py-0 align-middle">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <NftImage image={line.image} sizes="70px" decorative className="size-[56px] shrink-0 rounded-lg sm:size-[70px]" />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <p className="truncate text-body-md font-bold leading-4 sm:text-body-lg" title={line.title}>
                        {line.title}
                      </p>
                      <p className="truncate text-body leading-4 text-sand">ID do token: #{line.tokenId}</p>
                      <p className="sr-only">Edição {line.editionLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center align-middle text-body text-text-secondary">
                  <span aria-hidden>(x {line.quantity})</span>
                  <span className="sr-only">{line.quantity} {line.quantity === 1 ? 'unidade' : 'unidades'}</span>
                </td>
                <td className="text-right align-middle">
                  <EthValue value={line.lineTotalEth} className="text-body-lg font-bold text-text-accent sm:text-title-sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto flex w-full max-w-[321px] flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-body-md">Subtotal</dt>
            <dd>
              <EthValue value={order.subtotalEth} className="text-body-lg" />
            </dd>
          </div>
          {hasDiscount ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-md">
                Desconto{order.coupon ? <span className="text-caption text-text-secondary"> ({order.coupon.code})</span> : null}
              </dt>
              <dd className="text-success">
                <EthValue value={order.discountEth} prefix="(-)" className="text-body-lg" />
              </dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-body-md">Taxa de rede</dt>
            <dd>
              <EthValue value={order.networkFeeEth} className="text-title-sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-body-lg font-bold">Total</dt>
            <dd>
              <EthValue value={order.totalEth} className="text-title-sm font-bold text-text-accent" testId="receipt-total" />
            </dd>
          </div>
        </dl>
        <div aria-hidden className="h-px bg-primary/40" />

        <p className="px-2 text-center text-body leading-[22px] text-text-secondary">
          Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada
          {order.wallet.nickname ? ` (${order.wallet.nickname})` : ''} e registrada na rede.
        </p>

        {order.explorerUrl ? (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'lg' }), 'mx-auto mt-2 h-12 rounded-[5px] px-4 text-body-lg')}
            data-testid="explorer-link"
          >
            Ver no {explorer}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : null}
      </section>
    </div>
  )
}

function MetaItem({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className={cn('text-body leading-4', strong && 'font-bold')}>{label}</dt>
      <dd className="truncate text-body-md leading-5">{children}</dd>
    </div>
  )
}

function MetaDivider() {
  return <span aria-hidden className="hidden h-[31px] w-px shrink-0 bg-primary sm:block" />
}
