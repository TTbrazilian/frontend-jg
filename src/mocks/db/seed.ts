import Big from 'big.js'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Collection,
  type Creator,
  type NetworkId,
  type NftImage,
  type NftReview,
} from '@/api/contracts'
import { SEED_REFERENCE_DATE } from '../config'
import { hashHex, mulberry32 } from '../lib/hash'
import { hashPassword } from '../lib/password'
import type { DbCoupon, DbEdition, DbNft, DbState, DbUser, DbWallet } from './types'

/**
 * Seed determinístico (KURIO): mesma saída a cada reset (exceto `epoch`, que identifica a geração).
 * 48 NFTs nas 9 categorias e 3 redes, 8 criadores, 2 usuários, carteiras, cupons e favoritos.
 * Datas derivam de SEED_REFERENCE_DATE (nunca de Date.now()).
 */

const SEED = 20261125
const NFT_COUNT = 48
const HOUR = 3600 * 1000

export const SEED_PASSWORD = 'Password123!'

export const avatarUrl = (n: number): string => `/images/avatars/avatar-${(n % 4) + 1}.webp`
export const nftImageUrl = (n: number): string => `/images/nfts/nft-${(n % 4) + 1}.webp`

/** Títulos do Figma (primeiros 8) — os demais seguem "<Adjetivo> <Substantivo> #NNN". */
const FIGMA_TITLES: Array<[string, number]> = [
  ['Emerald Ape', 42],
  ['Sage Nomad', 9],
  ['Neon Vessel', 552],
  ['Cosmic Bloom', 118],
  ['Violet Nomad', 314],
  ['Ivory Baron', 88],
  ['Golden Beat', 207],
  ['Golden Signal', 160],
]
const ADJECTIVES = ['Emerald', 'Sage', 'Neon', 'Cosmic', 'Violet', 'Ivory', 'Golden', 'Crimson', 'Lunar', 'Velvet', 'Amber', 'Obsidian', 'Azure', 'Solar']
const NOUNS = ['Ape', 'Nomad', 'Vessel', 'Bloom', 'Baron', 'Beat', 'Signal', 'Echo', 'Relic', 'Drift', 'Pulse', 'Oracle', 'Tide', 'Spire', 'Fox']

const COLLECTION_BY_CATEGORY: Record<Category, Collection> = {
  'digital-art': { id: 'col-kurio-editions', name: 'Kurio Editions' },
  photography: { id: 'col-kurio-lens', name: 'Kurio Lens' },
  music: { id: 'col-kurio-sounds', name: 'Kurio Sounds' },
  '3d-art': { id: 'col-kurio-sculpt', name: 'Kurio Sculpt' },
  collectibles: { id: 'col-kurio-apes', name: 'Kurio Apes' },
  generative: { id: 'col-kurio-generative', name: 'Kurio Generative' },
  gaming: { id: 'col-kurio-arcade', name: 'Kurio Arcade' },
  subscriptions: { id: 'col-kurio-club', name: 'Kurio Club' },
  utility: { id: 'col-kurio-access', name: 'Kurio Access' },
}

const CREATOR_NAMES = ['Lia Moreno', 'Kenji Arakawa', 'Marina Duarte', 'Theo Okafor', 'Sofia Lindqvist', 'Rafael Nunes', 'Amara Singh', 'Estúdio Tapir']

/** Modelos de edição: rótulo, supply, multiplicador de preço (relativo à ABERTA) e opções de limite por pedido. */
const EDITION_TEMPLATES = [
  { key: '1-1', label: '1/1', supply: 1, multiplier: '6', maxPerOrder: [1] },
  { key: '1-10', label: '1/10', supply: 10, multiplier: '3', maxPerOrder: [1, 2, 3] },
  { key: '1-50', label: '1/50', supply: 50, multiplier: '1.6', maxPerOrder: [2, 3, 5] },
  { key: 'open', label: 'ABERTA', supply: 500, multiplier: '1', maxPerOrder: [5, 10] },
] as const

const ACCESSORIES = ['Óculos', 'Coroa', 'Fones', 'Capuz', 'Colar', 'Máscara', 'Chapéu', 'Brinco']
const COLORS = ['Esmeralda', 'Violeta', 'Dourado', 'Marfim', 'Neon', 'Safira', 'Coral', 'Grafite']
const REVIEW_AUTHORS = ['marina.eth', 'kenji', 'colecionador_42', 'luiza.art', 'pedro_nft', 'nomad_fan', 'sofia_l', 'theo.okafor', 'ana', 'rafa_n']
const REVIEW_COMMENTS = [
  'Arte impecável, as cores ficam ainda melhores em tela cheia.',
  'Entrega rápida e a edição chegou certinha na carteira.',
  'Uma das peças favoritas da minha coleção.',
  'Detalhes incríveis, vale cada ETH.',
  'Comunidade muito ativa em torno dessa coleção.',
  'Gostei bastante, mas esperava mais utilidades.',
  'Traços únicos, dá pra reconhecer o artista de longe.',
  'Comprei a edição aberta e já quero a 1/10.',
]

const FEATURED = new Set([0, 1, 3, 9, 14, 18, 27, 33])
const NETWORK_CYCLE: NetworkId[] = ['ethereum', 'ethereum', 'polygon', 'ethereum', 'solana']

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Endereço base58 determinístico (estilo Solana). */
export function base58Address(seed: string, length = 44): string {
  const hex = hashHex(seed, length * 2)
  let out = ''
  for (let i = 0; i < length; i++) out += BASE58[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % BASE58.length]
  return out
}

const evmAddress = (seed: string) => `0x${hashHex(seed, 40)}`

function editionKeysFor(i: number): Array<(typeof EDITION_TEMPLATES)[number]> {
  if (i === NFT_COUNT - 1) return [EDITION_TEMPLATES[0]] // a peça mais cara: 1/1 de 25 ETH
  const count = 1 + (i % 4)
  if (count === 1) return [EDITION_TEMPLATES[i % 8 === 0 ? 0 : 3]]
  return EDITION_TEMPLATES.slice(0, count)
}

function logUniform(rand: () => number, min: number, max: number): number {
  return Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * rand())
}

function roundEth(value: Big | number | string, decimals: number): string {
  return new Big(typeof value === 'number' ? value.toFixed(10) : value).round(decimals, Big.roundHalfEven).toFixed()
}

function buildTitles(rand: () => number): Array<{ title: string; tokenId: string }> {
  const used = new Set<number>()
  const out: Array<{ title: string; tokenId: string }> = []
  FIGMA_TITLES.forEach(([, n]) => used.add(n))
  for (let i = 0; i < NFT_COUNT; i++) {
    if (i < FIGMA_TITLES.length) {
      const [name, n] = FIGMA_TITLES[i]
      out.push({ title: `${name} #${String(n).padStart(3, '0')}`, tokenId: String(n).padStart(4, '0') })
      continue
    }
    let n = 1 + Math.floor(rand() * 998)
    while (used.has(n)) n = (n % 998) + 1
    used.add(n)
    const name = `${ADJECTIVES[(i * 5) % ADJECTIVES.length]} ${NOUNS[(i * 7 + 3) % NOUNS.length]}`
    out.push({ title: `${name} #${String(n).padStart(3, '0')}`, tokenId: String(n).padStart(4, '0') })
  }
  return out
}

function buildReviews(nftId: string, count: number, average: number, rand: () => number): NftReview[] {
  const reviews: NftReview[] = []
  for (let r = 0; r < Math.min(count, 8); r++) {
    const offset = [0, 0, 1, -1, 0, 1, 0, -1][r]
    reviews.push({
      id: `${nftId}-r${r + 1}`,
      author: REVIEW_AUTHORS[Math.floor(rand() * REVIEW_AUTHORS.length)],
      rating: Math.max(1, Math.min(5, Math.round(average) + offset)),
      comment: REVIEW_COMMENTS[Math.floor(rand() * REVIEW_COMMENTS.length)],
      createdAt: new Date(SEED_REFERENCE_DATE - (r + 1) * 31 * HOUR - Math.floor(rand() * 20) * HOUR).toISOString(),
    })
  }
  return reviews
}

function buildNfts(creators: Creator[]): DbNft[] {
  const rand = mulberry32(SEED)
  const titles = buildTitles(rand)
  const nfts: DbNft[] = []

  for (let i = 0; i < NFT_COUNT; i++) {
    const category = CATEGORIES[i % CATEGORIES.length]
    const network = NETWORK_CYCLE[i % NETWORK_CYCLE.length]
    const collection = COLLECTION_BY_CATEGORY[category]
    const creator = creators[(i * 3 + Math.floor(i / 9)) % creators.length]
    const { title, tokenId } = titles[i]
    const id = `nft-${String(i + 1).padStart(3, '0')}`

    const templates = editionKeysFor(i)
    const cheapest = templates[templates.length - 1]
    const topRatio = new Big(templates[0].multiplier).div(cheapest.multiplier)
    // Preço da edição mais barata: 0.005 (i = 0) … 25 (i = 47), log-uniforme no meio.
    let base: string
    if (i === 0) base = '0.005'
    else if (i === NFT_COUNT - 1) base = '25'
    else {
      const maxBase = Math.max(0.006, 25 / Number(topRatio.toFixed(6)))
      base = roundEth(logUniform(rand, 0.005, maxBase), [2, 3, 4, 6][Math.floor(rand() * 4)])
      if (new Big(base).lt('0.005')) base = '0.005'
    }

    const editions: DbEdition[] = templates.map((tpl) => {
      const sold = tpl.supply === 1 ? (rand() < 0.25 ? 1 : 0) : Math.floor(tpl.supply * rand() * 0.6)
      const price = new Big(base).times(tpl.multiplier).div(cheapest.multiplier)
      return {
        id: `${id}-${tpl.key}`,
        label: tpl.label,
        priceEth: roundEth(price, 6),
        supply: tpl.supply,
        available: tpl.supply - sold,
        maxPerOrder: tpl.maxPerOrder[Math.floor(rand() * tpl.maxPerOrder.length)],
        disabled: false,
      }
    })

    // Esgotados: 5 NFTs com todas as edições zeradas.
    if (i % 9 === 4) editions.forEach((ed) => (ed.available = 0))
    // Edição indisponível (retirada de venda) em NFTs com 2+ edições.
    if (editions.length >= 2 && i % 7 === 3) editions[editions.length - 1].disabled = true
    // Esgotamento parcial: a 1/1 já foi vendida, demais edições à venda.
    if (editions.length >= 2 && i % 5 === 1 && i % 9 !== 4) editions[0].available = 0
    // NFTs que não são "esgotados" precisam ter ao menos 1 unidade vendável.
    if (i % 9 !== 4 && editions.every((ed) => ed.disabled || ed.available === 0)) {
      const target = editions.find((ed) => !ed.disabled) ?? editions[0]
      target.available = 1
    }

    const label = CATEGORY_LABELS[category].toLowerCase()
    const alt = `${title}: ${label} de ${creator.name} na coleção ${collection.name}`
    const images: NftImage[] = [0, 1, 2, 3].map((k) => ({
      url: nftImageUrl(i + k),
      alt: k === 0 ? alt : `${title}: vista alternativa ${k}`,
      width: 600,
      height: 600,
    }))

    const ratingCount = i % 11 === 10 ? 0 : Math.floor(rand() * 41)
    const ratingAverage = ratingCount === 0 ? 0 : (38 + Math.floor(rand() * 13)) / 10
    const badge = i % 7 === 0 ? 'rare' : null
    const compareAt = i % 5 === 2 ? roundEth(new Big(base).times('1.25'), 6) : null
    const accessory = ACCESSORIES[(i * 3) % ACCESSORIES.length]
    const color = COLORS[(i * 5) % COLORS.length]

    nfts.push({
      id,
      tokenId,
      title,
      description: `${title} é uma peça de ${label} da coleção ${collection.name}, assinada por ${creator.name}.`,
      longDescription:
        `${title} nasceu no estúdio de ${creator.name} como parte da coleção ${collection.name}. ` +
        `A obra explora tons de ${color.toLowerCase()} e texturas digitais pensadas para telas de alta resolução.\n\n` +
        `Cada edição é registrada na rede ${network === 'solana' ? 'Solana' : network === 'polygon' ? 'Polygon' : 'Ethereum'} ` +
        `e dá acesso ao arquivo original, a conteúdos exclusivos da comunidade KURIO e a 5% de royalties para o criador em revendas.`,
      creator,
      collection,
      category,
      network,
      images,
      editions,
      attributes: [accessory, color, badge === 'rare' ? 'Raro' : i % 3 === 0 ? 'Incomum' : 'Comum'],
      reviews: buildReviews(id, ratingCount, ratingAverage, rand),
      rating: { average: ratingAverage, count: ratingCount },
      compareAtPriceEth: compareAt,
      badge,
      contractAddress: network === 'solana' ? base58Address(`contract:${collection.id}:sol`) : evmAddress(`contract:${collection.id}:${network}`),
      tokenStandard: editions.length === 1 && editions[0].supply === 1 ? 'ERC-721' : 'ERC-1155',
      royaltiesPercent: 5,
      featured: FEATURED.has(i),
      trending: i % 4 === 1,
      baseFavorites: Math.floor(rand() * 480),
      // ~55h entre lançamentos: os 14 primeiros caem na janela de 30 dias ("Novos lançamentos").
      createdAt: new Date(SEED_REFERENCE_DATE - (i * 55 + (i % 4) + 2) * HOUR).toISOString(),
      version: 1,
    })
  }
  return nfts
}

const COUPONS: DbCoupon[] = [
  { code: 'WELCOME10', description: '10% de desconto de boas-vindas', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'JUNGLE25', description: '25% de desconto Jungle', percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRED20', description: '20% de desconto (campanha encerrada)', percentOff: 20, expiresAt: '2024-01-31T23:59:59.000Z' },
]

type SeedUser = Omit<DbUser, 'passwordSalt' | 'passwordHash'>

const SEED_USERS: SeedUser[] = [
  {
    id: 'usr-ana',
    displayName: 'Ana Collector',
    username: 'ana',
    email: 'ana@nft.dev',
    ensName: 'ana-kurio',
    walletNickname: 'Principal',
    avatarUrl: avatarUrl(1),
    createdAt: '2026-03-14T12:00:00.000Z',
  },
  {
    id: 'usr-bruno',
    displayName: 'Bruno Holder',
    username: 'bruno',
    email: 'bruno@nft.dev',
    ensName: null,
    walletNickname: 'Principal',
    avatarUrl: null,
    createdAt: '2026-05-02T09:30:00.000Z',
  },
]

function wallet(input: Omit<DbWallet, 'address' | 'updatedAt' | 'ensOrSecondary'> & { ensOrSecondary?: string | null }): DbWallet {
  const address = input.network === 'solana' ? base58Address(`wallet:${input.id}`) : evmAddress(`wallet:${input.id}`)
  return { ...input, ensOrSecondary: input.ensOrSecondary ?? null, address, updatedAt: input.createdAt }
}

let generation = 0

export async function buildSeed(): Promise<DbState> {
  const creators: Creator[] = CREATOR_NAMES.map((name, i) => ({ id: `creator-${i + 1}`, name, avatarUrl: avatarUrl(i) }))
  const users: DbUser[] = await Promise.all(
    SEED_USERS.map(async (u) => {
      const passwordSalt = hashHex(`salt:${u.email}`, 32)
      return { ...u, passwordSalt, passwordHash: await hashPassword(SEED_PASSWORD, passwordSalt) }
    }),
  )
  generation += 1
  return {
    schema: 1,
    epoch: hashHex(`epoch:${Date.now()}:${generation}`, 8),
    users,
    sessions: [],
    nfts: buildNfts(creators),
    favorites: { 'usr-ana': ['nft-003', 'nft-010'], 'usr-bruno': [] },
    carts: [],
    coupons: COUPONS.map((c) => ({ ...c })),
    quotes: [],
    orders: [],
    idempotency: [],
    wallets: [
      wallet({
        id: 'wal-ana-1',
        userId: 'usr-ana',
        role: 'primary',
        displayName: 'Ana Collector',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'ana',
        provider: 'metamask',
        referralCode: 'ANA2026',
        email: 'ana@nft.dev',
        ensName: 'ana-kurio',
        createdAt: '2026-03-14T12:10:00.000Z',
      }),
      wallet({
        id: 'wal-ana-2',
        userId: 'usr-ana',
        role: 'secondary',
        displayName: 'Ana Collector',
        nickname: 'Reserva',
        network: 'polygon',
        profileName: 'ana',
        provider: 'coinbase',
        referralCode: 'ANA2026',
        email: 'ana@nft.dev',
        ensName: 'nova',
        createdAt: '2026-04-02T18:45:00.000Z',
      }),
      wallet({
        id: 'wal-bruno-1',
        userId: 'usr-bruno',
        role: 'primary',
        displayName: 'Bruno Holder',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'bruno',
        provider: 'walletconnect',
        referralCode: 'BRUNO01',
        email: 'bruno@nft.dev',
        ensName: 'bruno-holder',
        createdAt: '2026-05-02T09:40:00.000Z',
      }),
    ],
    walletConnections: [],
  }
}
