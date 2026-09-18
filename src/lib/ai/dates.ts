/**
 * Interpretação de datas em linguagem natural (pt-BR).
 *
 * Determinístico e testável — sem chamada de rede. É usado tanto pelo extrator
 * heurístico quanto para validar/normalizar o que um LLM devolve, porque modelo
 * de linguagem erra data com frequência e aqui a precisão importa.
 */

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1, 'segunda-feira': 1,
  terca: 2, 'terça': 2, 'terca-feira': 2, 'terça-feira': 2,
  quarta: 3, 'quarta-feira': 3,
  quinta: 4, 'quinta-feira': 4,
  sexta: 5, 'sexta-feira': 5,
  sabado: 6, 'sábado': 6,
};

const MONTHS: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, 'março': 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

export interface ParsedDate {
  date: Date;
  /** Trecho do texto que originou a data — usado para destacar na UI. */
  matched: string;
  confidence: number;
}

function atEndOfBusinessDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(18, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Próxima ocorrência de um dia da semana (hoje conta como "próxima" se ainda não passou). */
function nextWeekday(from: Date, weekday: number, forceNextWeek = false): Date {
  const current = from.getDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0 && !forceNextWeek) delta = 0;
  if (forceNextWeek) delta = delta === 0 ? 7 : delta + 7 - (delta > 0 ? 0 : 0);
  return addDays(from, delta);
}

/**
 * Extrai a primeira referência temporal encontrada no texto.
 * Retorna null quando não há nenhuma — o chamador NÃO deve inventar prazo.
 */
export function parseNaturalDate(text: string, now = new Date()): ParsedDate | null {
  const normalized = text.toLowerCase();

  // 1. Datas explícitas: 20/09, 20/09/2026, 20-09-2026
  const numeric = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const yearRaw = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const candidate = new Date(year, month, day);
    if (candidate.getMonth() === month && candidate.getDate() === day) {
      return { date: atEndOfBusinessDay(candidate), matched: numeric[0], confidence: 0.95 };
    }
  }

  // 2. "dia 20 de setembro" / "20 de setembro"
  const withMonth = normalized.match(
    /\b(?:dia\s+)?(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/,
  );
  if (withMonth) {
    const day = Number(withMonth[1]);
    const month = MONTHS[withMonth[2]!];
    if (month !== undefined) {
      let candidate = new Date(now.getFullYear(), month, day);
      // Data já passada sem ano explícito normalmente se refere ao ano seguinte.
      if (candidate.getTime() < now.getTime() - 86_400_000) {
        candidate = new Date(now.getFullYear() + 1, month, day);
      }
      return { date: atEndOfBusinessDay(candidate), matched: withMonth[0], confidence: 0.9 };
    }
  }

  // 3. Relativos simples
  if (/\bhoje\b/.test(normalized)) {
    return { date: atEndOfBusinessDay(now), matched: 'hoje', confidence: 0.95 };
  }
  if (/\bamanh[ãa]\b/.test(normalized)) {
    return { date: atEndOfBusinessDay(addDays(now, 1)), matched: 'amanhã', confidence: 0.95 };
  }
  if (/\bdepois de amanh[ãa]\b/.test(normalized)) {
    return { date: atEndOfBusinessDay(addDays(now, 2)), matched: 'depois de amanhã', confidence: 0.9 };
  }

  // 4. "em N dias/semanas"
  const inDays = normalized.match(/\bem\s+(\d{1,3})\s+(dias?|semanas?|m[eê]s(?:es)?)\b/);
  if (inDays) {
    const amount = Number(inDays[1]);
    const unit = inDays[2]!;
    const days = unit.startsWith('semana') ? amount * 7 : unit.startsWith('m') ? amount * 30 : amount;
    return { date: atEndOfBusinessDay(addDays(now, days)), matched: inDays[0], confidence: 0.85 };
  }

  // 5. Dias da semana, com ou sem "próxima"
  const weekdayMatch = normalized.match(
    /\b(pr[óo]xim[ao]\s+)?(domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado)\b/,
  );
  if (weekdayMatch) {
    const key = weekdayMatch[2]!;
    const weekday = WEEKDAYS[key];
    if (weekday !== undefined) {
      const forceNext = Boolean(weekdayMatch[1]);
      let target = nextWeekday(now, weekday, false);
      if (forceNext || target.toDateString() === now.toDateString()) {
        target = addDays(target, target.toDateString() === now.toDateString() && !forceNext ? 0 : 7);
      }
      return { date: atEndOfBusinessDay(target), matched: weekdayMatch[0], confidence: 0.85 };
    }
  }

  // 6. Blocos vagos, porém úteis
  if (/\bfim (?:da|de) semana\b/.test(normalized)) {
    return { date: atEndOfBusinessDay(nextWeekday(now, 6)), matched: 'fim de semana', confidence: 0.7 };
  }
  if (/\bpr[óo]xima semana\b|\bsemana que vem\b/.test(normalized)) {
    return { date: atEndOfBusinessDay(addDays(now, 7)), matched: 'próxima semana', confidence: 0.7 };
  }
  if (/\bfim do m[eê]s\b/.test(normalized)) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date: atEndOfBusinessDay(endOfMonth), matched: 'fim do mês', confidence: 0.75 };
  }

  return null;
}

/** Combina data encontrada com um horário explícito ("às 14h", "14:30"). */
export function applyTimeOfDay(date: Date, text: string): Date {
  const match = text.toLowerCase().match(/\b(?:[àa]s\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?\b/);
  if (!match) return date;
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return date;
  // Evita interpretar "20 de setembro" ou "5 tarefas" como horário.
  if (!/(?:[àa]s|h|horas?|:)/.test(match[0])) return date;
  const result = new Date(date);
  result.setHours(hour, match[2] ? Number(match[2]) : 0, 0, 0);
  return result;
}
