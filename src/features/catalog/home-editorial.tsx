import { ArrowRightIcon } from '@/components/icons'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'

/*
 * Seções editoriais estáticas do Figma (Promos e "Diário da Cunhagem"). Textos e artes são do
 * próprio Figma; os destinos (lançamentos, artigos) não fazem parte do escopo e avisam isso.
 */

const art = (n: number) => ({ src: `/images/nfts/nft-${n}.webp`, srcSet: `/images/nfts/nft-${n}-480.webp 480w, /images/nfts/nft-${n}.webp 900w` })

const PROMOS = [
  {
    title: 'Lançamentos gênesis\nde edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: art(1),
    feature: 'Lançamentos gênesis',
  },
  {
    title: 'Arte digital selecionada\ne muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: art(3),
    feature: 'Arte digital selecionada',
  },
] as const

export function PromoCards({ className }: { className?: string }) {
  return (
    <section aria-label="Promoções" className={cn('grid gap-7 md:grid-cols-2', className)}>
      {PROMOS.map((p) => (
        <article key={p.feature} className="relative isolate flex min-h-[250px] overflow-hidden rounded-lg bg-card">
          <img
            src={p.image.src}
            srcSet={p.image.srcSet}
            sizes="(min-width: 1024px) 290px, 45vw"
            width={900}
            height={900}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-[44%] shrink-0 rounded-[18px] object-cover sm:w-[49%]"
          />
          {/* Arcos decorativos do Figma */}
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 -z-0 size-64 rounded-full border border-primary/40" />
          <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-4 p-5 text-right sm:pr-[30px]">
            <h3 className="whitespace-pre-line text-title-sm font-bold leading-6 text-foreground">{p.title}</h3>
            <p className="max-w-[263px] text-body leading-[15px] text-text-secondary">{p.text}</p>
            <button
              type="button"
              onClick={() => comingSoon(p.feature)}
              className="mt-1 inline-flex h-10 w-[140px] items-center justify-center gap-2 rounded-md bg-primary text-body font-medium text-primary-foreground transition-colors hover:bg-brand-light active:bg-brand-dark"
            >
              Explorar
              <ArrowRightIcon width={18} height={18} />
              <span className="sr-only">: {p.feature}</span>
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 'Leitura de 6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: art(3) },
  { date: '13 de setembro', read: 'Leitura de 2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: art(1) },
  { date: '15 de setembro', read: 'Leitura de 3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: art(2) },
  { date: '15 de setembro', read: 'Leitura de 2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: art(4) },
] as const

export function BlogSection({ className }: { className?: string }) {
  return (
    <section aria-labelledby="blog-title" className={cn('flex flex-col items-center gap-10', className)}>
      <header className="flex flex-col items-center gap-3 text-center">
        <h2 id="blog-title" className="text-heading-lg font-bold leading-[37px] text-foreground">
          Diário da Cunhagem
        </h2>
        <p className="text-body text-text-secondary">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-card">
              <img
                src={post.image.src}
                srcSet={post.image.srcSet}
                sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
                width={900}
                height={900}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-[195px] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                <p className="text-caption font-medium leading-4 text-text-secondary">
                  {post.date}
                  <span aria-hidden className="px-2">
                    |
                  </span>
                  <span className="sr-only">, </span>
                  {post.read}
                </p>
                <h3 className="text-body-lg font-bold leading-[21px] text-foreground">{post.title}</h3>
                <p className="text-caption font-medium leading-4 text-text-secondary">{post.text}</p>
                <button
                  type="button"
                  onClick={() => comingSoon('Diário da Cunhagem')}
                  className="mt-auto flex w-fit items-center gap-1 rounded-xs pt-1 text-caption font-bold leading-[14px] text-text-accent hover:underline"
                >
                  Ler mais<span className="sr-only">: {post.title}</span>
                  <span aria-hidden>→</span>
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
