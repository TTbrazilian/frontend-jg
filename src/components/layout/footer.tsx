import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CATEGORY_LABELS, type Category } from '@/api/contracts'
import {
  FacebookSquareIcon,
  InstagramSquareIcon,
  LinkedinSquareIcon,
  TwitterSquareIcon,
  YoutubeSquareIcon,
} from '@/components/icons'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import { Container } from './container'

const SERVICES = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
] as const

const SOCIALS = [
  { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FacebookSquareIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/', Icon: InstagramSquareIcon },
  { label: 'X (Twitter)', href: 'https://x.com/', Icon: TwitterSquareIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: LinkedinSquareIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: YoutubeSquareIcon },
] as const

const FOOTER_CATEGORIES: Category[] = ['digital-art', 'photography', 'music', '3d-art', 'utility']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const linkClass = 'rounded-xs text-left text-body leading-[30px] text-foreground transition-colors hover:text-text-accent'

function SoonLink({ children, feature }: { children: ReactNode; feature?: string }) {
  return (
    <button type="button" className={linkClass} onClick={() => comingSoon(feature ?? String(children))}>
      {children}
    </button>
  )
}

function LinkColumn({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <nav aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h2 id={id} className="text-title-sm font-bold leading-4 text-foreground">
        {title}
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </nav>
  )
}

/** "Antecipe-se ao próximo lançamento": valida o e-mail; o envio não existe na demonstração e avisa isso. */
function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return setError('Informe seu e-mail.')
    if (!EMAIL_RE.test(value)) return setError('Informe um e-mail válido, ex.: nome@dominio.com')
    setError(null)
    comingSoon('Newsletter')
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-title-sm font-bold leading-4 text-foreground">
        Antecipe-se ao próximo lançamento
      </h2>
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`} className="mt-1 flex flex-col gap-2">
        <div className="flex h-10 overflow-hidden rounded-md bg-surface-dark shadow-overlay focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <label htmlFor={`${id}-email`} className="sr-only">
            Seu e-mail
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder="digite seu e-mail..."
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            className="min-w-0 flex-1 bg-transparent px-3 text-body text-foreground placeholder:text-sand focus-visible:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-r-md bg-primary px-4 text-title-sm font-bold text-primary-foreground transition-colors hover:bg-brand-light active:bg-brand-dark"
          >
            Enviar
          </button>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-caption text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      <p id={`${id}-hint`} className="text-body-sm leading-[22px] text-text-secondary">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </div>
  )
}

/** Rodapé do Figma (todas as telas desktop; mobile exceto telas imersivas). */
export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('pb-6', className)}>
      <Container>
        {/* Serviços + newsletter */}
        <div className="grid gap-8 bg-card p-6 md:grid-cols-2 md:p-8 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,357px)] lg:gap-0">
          {SERVICES.map((s) => (
            <div key={s.mark} className="flex flex-col gap-3 lg:border-r lg:border-primary lg:px-4 lg:first:pl-4">
              <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-primary text-heading font-bold text-primary-foreground">
                {s.mark}
              </span>
              <h2 className="text-[1.0625rem] font-bold leading-4 text-foreground">{s.title}</h2>
              <p className="max-w-[204px] text-body leading-[22px] text-text-secondary">{s.text}</p>
            </div>
          ))}
          <div className="lg:px-4">
            <Newsletter />
          </div>
        </div>

        {/* Faixa da marca e contato */}
        <div className="grid grid-cols-1 items-center gap-4 bg-surface-dark px-6 py-6 sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:gap-x-12 lg:py-8">
          <Link to="/" className="w-fit rounded-xs py-2 text-body font-bold tracking-[0.1em] text-foreground">
            KURIO<span className="sr-only"> — página inicial</span>
          </Link>
          <p className="text-body leading-[22px] text-foreground">
            Feito para colecionadores,
            <br />
            criadores e cultura
          </p>
          <a href="mailto:contato@email.com" className="w-fit rounded-xs text-body leading-[22px] text-foreground hover:text-text-accent">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="w-fit rounded-xs text-body leading-[22px] text-foreground hover:text-text-accent">
            +55 11 4002 8922
          </a>
        </div>

        {/* Colunas de links */}
        <div className="grid grid-cols-1 gap-8 bg-card p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-4 lg:gap-x-12">
          <LinkColumn title="Meu perfil">
            <li>
              <Link to="/perfil" className={linkClass}>
                Meu perfil
              </Link>
            </li>
            <li>
              <SoonLink>Minha coleção</SoonLink>
            </li>
            <li>
              <SoonLink>Atividade</SoonLink>
            </li>
            <li>
              <SoonLink>Estúdio do criador</SoonLink>
            </li>
            <li>
              <Link to="/perfil/favoritos" className={linkClass}>
                Lista de interesse
              </Link>
            </li>
          </LinkColumn>
          <LinkColumn title="Central de ajuda">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((label) => (
              <li key={label}>
                <SoonLink>{label}</SoonLink>
              </li>
            ))}
          </LinkColumn>
          <LinkColumn title="Coleções">
            {FOOTER_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/mercado" search={{ category: c }} className={linkClass}>
                  {CATEGORY_LABELS[c]}
                </Link>
              </li>
            ))}
          </LinkColumn>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <h2 className="text-title-sm font-bold leading-4 text-foreground">Redes sociais</h2>
              <ul className="flex flex-wrap items-center gap-2.5">
                {SOCIALS.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-[30px] place-items-center rounded-sm text-primary transition-colors hover:text-text-accent"
                      title={`${label} (abre em nova aba)`}
                    >
                      <Icon width={30} height={30} />
                      <span className="sr-only">{label} (abre em nova aba)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-title-sm font-bold leading-4 text-foreground">Carteiras compatíveis</h2>
              <p className="w-fit rounded-md border border-border-soft bg-surface-dark px-2.5 py-2 text-[0.5625rem] font-bold uppercase leading-3 tracking-[0.01em] text-text-accent">
                MetaMask <span aria-hidden>•</span> WalletConnect <span aria-hidden>•</span> Coinbase
              </p>
            </div>
          </div>
        </div>

        <p className="pt-1.5 text-center text-body leading-[30px] text-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
      </Container>
    </footer>
  )
}
