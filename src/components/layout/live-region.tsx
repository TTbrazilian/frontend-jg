import { useEffect, useState } from 'react'

/**
 * Região aria-live global para anunciar mutations e eventos em tempo real
 * (complementa os toasts visuais).
 */
type Politeness = 'polite' | 'assertive'
type Listener = (msg: string, politeness: Politeness) => void
const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite') {
  listeners.forEach((l) => l(message, politeness))
}

export function LiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(() => {
    const l: Listener = (msg, p) => {
      const set = p === 'assertive' ? setAssertive : setPolite
      set('')
      // força releitura mesmo com mensagem idêntica
      window.setTimeout(() => set(msg), 50)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
