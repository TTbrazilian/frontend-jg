import { NETWORK_LABELS, WALLET_PROVIDER_LABELS, type Wallet } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'

/** Resumo da carteira salva (sem frame no Figma: mesmos rótulos do formulário, em 2 colunas). */
export function WalletSummary({ wallet }: { wallet: Wallet }) {
  const rows: Array<[string, string]> = [
    ['Nome de exibição', wallet.displayName],
    ['Apelido da carteira', wallet.nickname],
    ['Rede', NETWORK_LABELS[wallet.network]],
    ['Nome do perfil', wallet.profileName],
    ['Endereço da carteira', wallet.address],
    ['ENS ou carteira secundária', wallet.ensOrSecondary ?? '—'],
    ['Tipo de carteira', WALLET_PROVIDER_LABELS[wallet.provider]],
    ['Código de indicação', wallet.referralCode],
    ['E-mail', wallet.email],
    ['Nome ENS', `${wallet.ensName}.eth`],
  ]
  return (
    <dl data-testid={`wallet-summary-${wallet.role}`} className="grid gap-x-7 gap-y-5 rounded-lg border border-border bg-card p-5 md:grid-cols-2 md:p-6">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-1.5">
          <dt className="text-caption text-text-secondary">{label}</dt>
          <dd className="break-all text-body text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function WalletSummarySkeleton() {
  return (
    <div aria-hidden className="grid gap-x-7 gap-y-5 rounded-lg border border-border bg-card p-5 md:grid-cols-2 md:p-6">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ))}
    </div>
  )
}
