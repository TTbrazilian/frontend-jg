import Big from 'big.js'
import type { EthAmount } from '@/api/contracts'

// Precisão de ETH (wei = 18 casas). Arredondamento "half-even" para evitar viés.
Big.DP = 18
Big.RM = Big.roundHalfEven

export const eth = (value: EthAmount | number | Big): Big => new Big(value)

export function addEth(...values: EthAmount[]): EthAmount {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString()
}

export function mulEth(value: EthAmount, qty: number): EthAmount {
  return new Big(value).times(qty).toString()
}

export function compareEth(a: EthAmount, b: EthAmount): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1
}

export function isValidEthInput(value: string): boolean {
  return /^\d+(\.\d{1,18})?$/.test(value.trim())
}

/**
 * Formata para exibição sem perder precisão: até `maxDecimals` casas,
 * removendo zeros à direita. Nunca converte para number.
 */
export function formatEth(value: EthAmount, { maxDecimals = 4, withUnit = true } = {}): string {
  const big = new Big(value)
  let fixed = big.toFixed(maxDecimals, Big.roundHalfEven)
  if (fixed.includes('.')) fixed = fixed.replace(/0+$/, '').replace(/\.$/, '')
  if (big.gt(0) && new Big(fixed).eq(0)) fixed = `<${new Big(1).div(new Big(10).pow(maxDecimals)).toFixed(maxDecimals)}`
  const [int, dec] = fixed.split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const out = dec ? `${intFmt}.${dec}` : intFmt
  return withUnit ? `${out} ETH` : out
}

export function formatEthFull(value: EthAmount): string {
  return `${new Big(value).toFixed()} ETH`
}
