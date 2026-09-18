/** Formatação de datas, números e textos — sempre em pt-BR. */

const TZ = 'America/Sao_Paulo';

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...options }).format(value);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatShortDate(date: Date | string): string {
  return formatDate(date, { day: '2-digit', month: 'short' });
}

export function formatTime(date: Date | string): string {
  return formatDate(date, { hour: '2-digit', minute: '2-digit' });
}

export function formatLongDate(date: Date | string): string {
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "há 5 min", "em 2 h" — usa a API nativa de tempo relativo. */
export function formatRelative(date: Date | string, now = new Date()): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const diffMs = value.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
  ];

  let value_ = diffSec;
  for (const [unit, limit] of units) {
    if (Math.abs(value_) < limit) return formatter.format(Math.round(value_), unit);
    value_ /= limit;
  }
  return formatter.format(Math.round(value_), 'year');
}

/** Rótulo humano para prazos: "Hoje", "Amanhã", "Atrasada há 2 dias". */
export function formatDueLabel(due: Date | string | null, now = new Date()): { label: string; tone: 'neutral' | 'warning' | 'danger' | 'success' } {
  if (!due) return { label: 'Sem prazo', tone: 'neutral' };
  const value = typeof due === 'string' ? new Date(due) : due;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(value) - startOfDay(now)) / 86_400_000);

  if (days < 0) return { label: days === -1 ? 'Atrasada 1 dia' : `Atrasada ${Math.abs(days)} dias`, tone: 'danger' };
  if (days === 0) return { label: 'Hoje', tone: 'warning' };
  if (days === 1) return { label: 'Amanhã', tone: 'warning' };
  if (days <= 7) return { label: `Em ${days} dias`, tone: 'neutral' };
  return { label: formatShortDate(value), tone: 'neutral' };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Cor determinística a partir de um id — avatares sem foto ficam consistentes. */
export function colorFromId(id: string): string {
  const palette = ['#2E7DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#22C55E'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
