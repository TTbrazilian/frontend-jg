import type { Quote } from '@/api/contracts'
import { compareEth, formatEth } from '@/lib/money'

/**
 * Diferenças legíveis entre a cotação que o usuário revisou e a nova cotação do servidor
 * (preço, quantidade, itens removidos/adicionados, taxa, desconto, total e pendências).
 */
export function diffQuotes(previous: Quote, next: Quote): string[] {
  const changes: string[] = []
  for (const line of previous.lines) {
    const now = next.lines.find((l) => l.itemId === line.itemId)
    const name = `${line.title} (${line.editionLabel})`
    if (!now) {
      changes.push(`${name} saiu do pedido.`)
      continue
    }
    if (compareEth(line.unitPriceEth, now.unitPriceEth) !== 0) {
      changes.push(`Preço de ${name}: de ${formatEth(line.unitPriceEth)} para ${formatEth(now.unitPriceEth)}.`)
    }
    if (line.quantity !== now.quantity) {
      changes.push(`Quantidade de ${name}: de ${line.quantity} para ${now.quantity}.`)
    }
  }
  for (const line of next.lines) {
    if (!previous.lines.some((l) => l.itemId === line.itemId)) changes.push(`${line.title} (${line.editionLabel}) entrou no pedido.`)
  }
  if (compareEth(previous.discountEth, next.discountEth) !== 0) {
    changes.push(`Desconto: de ${formatEth(previous.discountEth)} para ${formatEth(next.discountEth)}.`)
  }
  if (compareEth(previous.networkFeeEth, next.networkFeeEth) !== 0) {
    changes.push(`Taxa de rede: de ${formatEth(previous.networkFeeEth)} para ${formatEth(next.networkFeeEth)}.`)
  }
  if (compareEth(previous.totalEth, next.totalEth) !== 0) {
    changes.push(`Total: de ${formatEth(previous.totalEth)} para ${formatEth(next.totalEth)}.`)
  }
  for (const issue of next.issues) {
    if (issue.type !== 'price_changed') changes.push(issue.message)
  }
  if (changes.length === 0 && previous.fingerprint !== next.fingerprint) {
    changes.push('A disponibilidade dos itens foi atualizada.')
  }
  return changes
}

/** Mesmos valores (linhas, quantidades, preços e totais), ignorando o estado das pendências. */
export function sameQuoteValues(a: Quote, b: Quote): boolean {
  if (a.network !== b.network || a.lines.length !== b.lines.length) return false
  const totals = (['subtotalEth', 'discountEth', 'networkFeeEth', 'totalEth'] as const).every((k) => compareEth(a[k], b[k]) === 0)
  return (
    totals &&
    a.lines.every((l) => {
      const o = b.lines.find((x) => x.itemId === l.itemId)
      return !!o && o.quantity === l.quantity && compareEth(o.unitPriceEth, l.unitPriceEth) === 0
    })
  )
}
