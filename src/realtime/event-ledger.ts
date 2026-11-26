import type { RealtimeEnvelope, RealtimeEventType } from '@/api/contracts'

/**
 * Deduplicação e ordenação de eventos:
 * - `eventId` já visto → descartado (duplicata, não reaplica efeitos);
 * - `version` <= última versão aplicada do mesmo recurso → descartado (evento antigo).
 * Mantém no máximo `max` ids (LRU simples).
 */
export class EventLedger {
  private seen = new Map<string, true>()
  private versions = new Map<string, number>()

  constructor(private readonly max = 500) {}

  accept(event: RealtimeEnvelope<RealtimeEventType, unknown>): boolean {
    if (this.seen.has(event.eventId)) return false
    const key = `${event.resource.type}:${event.resource.id}`
    const last = this.versions.get(key)
    if (last !== undefined && event.version <= last) {
      this.remember(event.eventId)
      return false
    }
    this.versions.set(key, event.version)
    this.remember(event.eventId)
    return true
  }


  private remember(id: string) {
    this.seen.set(id, true)
    if (this.seen.size > this.max) {
      const first = this.seen.keys().next().value
      if (first !== undefined) this.seen.delete(first)
    }
  }
}
