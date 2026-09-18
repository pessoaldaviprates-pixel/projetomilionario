/**
 * Barramento de eventos em tempo real.
 *
 * Hoje: EventEmitter em processo + SSE por cliente. Funciona perfeitamente em
 * uma instância e não adiciona infraestrutura ao MVP.
 *
 * Amanhã (multi-instância): trocar `InMemoryBus` por um adaptador Redis
 * Pub/Sub implementando a mesma interface `EventBus`. Nenhum service muda,
 * porque todos publicam através de `publish()`.
 */
import 'server-only';
import { EventEmitter } from 'node:events';

export type RealtimeEventType =
  | 'message.created' | 'message.updated' | 'message.deleted' | 'message.reaction'
  | 'typing.start' | 'typing.stop'
  | 'presence.changed'
  | 'task.created' | 'task.updated' | 'task.deleted'
  | 'project.updated'
  | 'meeting.started' | 'meeting.ended'
  | 'notification.created'
  | 'announcement.published';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  /** Escopo do evento: sempre o tenant. Nunca entregamos evento cross-tenant. */
  companyId: string;
  /** Canal lógico opcional (id do canal, projeto, membership). */
  topic?: string;
  payload: T;
  at: string;
}

export interface EventBus {
  publish(event: RealtimeEvent): void;
  subscribe(companyId: string, listener: (event: RealtimeEvent) => void): () => void;
}

class InMemoryBus implements EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Uma empresa grande pode ter muitas abas conectadas simultaneamente.
    this.emitter.setMaxListeners(0);
  }

  publish(event: RealtimeEvent): void {
    this.emitter.emit(`company:${event.companyId}`, event);
  }

  subscribe(companyId: string, listener: (event: RealtimeEvent) => void): () => void {
    const key = `company:${companyId}`;
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }
}

const globalForBus = globalThis as unknown as { nexoraBus?: EventBus };
export const bus: EventBus = globalForBus.nexoraBus ?? new InMemoryBus();
globalForBus.nexoraBus = bus;

export function publish<T>(
  type: RealtimeEventType,
  companyId: string,
  payload: T,
  topic?: string,
): void {
  bus.publish({ type, companyId, topic, payload, at: new Date().toISOString() });
}
