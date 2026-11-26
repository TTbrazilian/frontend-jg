import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Footer } from './footer'
import { Header } from './header'
import { MobileTabBar } from './mobile-tab-bar'
import { isImmersiveMobilePath, usePathname } from './route-flags'

/**
 * Esqueleto de todas as telas: header (desktop: nav; mobile: busca + filtros), `<main id="conteudo">`
 * (alvo do "Pular para o conteúdo"), rodapé e tab bar fixa no mobile. Telas "imersivas" no mobile
 * (detalhe, carrinho, pagamento, login…) têm barras próprias: aí header, rodapé e tab bar somem < 768px.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const immersive = isImmersiveMobilePath(pathname)

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col',
        // espaço para a tab bar fixa (95px + área segura) não cobrir o fim da página
        !immersive && 'max-md:pb-[calc(95px+env(safe-area-inset-bottom)+1.5rem)]',
      )}
    >
      <Header />
      <main id="conteudo" tabIndex={-1} className="flex min-h-dvh min-w-0 flex-1 flex-col outline-none">
        {children}
      </main>
      <Footer className={cn(immersive && 'max-md:hidden')} />
      <MobileTabBar />
    </div>
  )
}
