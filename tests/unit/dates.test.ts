import { describe, expect, it } from 'vitest';
import { applyTimeOfDay, parseNaturalDate } from '@/lib/ai/dates';

/**
 * A interpretação de datas sustenta o principal diferencial do produto:
 * transformar "até sexta" numa data real. Errar aqui significa criar tarefas
 * com prazo errado — por isso cada formato suportado tem teste.
 */
describe('parseNaturalDate', () => {
  // Quarta-feira, 16 de setembro de 2026, meio-dia.
  const now = new Date(2026, 8, 16, 12, 0, 0);

  it('reconhece "hoje"', () => {
    const result = parseNaturalDate('preciso terminar isso hoje', now);
    expect(result).not.toBeNull();
    expect(result!.date.getDate()).toBe(16);
    expect(result!.date.getMonth()).toBe(8);
  });

  it('reconhece "amanhã" com e sem acento', () => {
    expect(parseNaturalDate('entrego amanhã', now)!.date.getDate()).toBe(17);
    expect(parseNaturalDate('entrego amanha', now)!.date.getDate()).toBe(17);
  });

  it('reconhece dia da semana futuro na mesma semana', () => {
    // De quarta, "sexta" é dia 18.
    const result = parseNaturalDate('a apresentação fica pronta até sexta-feira', now);
    expect(result!.date.getDate()).toBe(18);
  });

  it('"próxima sexta" cai na semana seguinte', () => {
    const result = parseNaturalDate('vamos revisar na próxima sexta', now);
    expect(result!.date.getDate()).toBe(25);
  });

  it('reconhece data numérica', () => {
    const result = parseNaturalDate('o prazo é 20/09', now);
    expect(result!.date.getDate()).toBe(20);
    expect(result!.date.getMonth()).toBe(8);
  });

  it('reconhece "dia X de mês"', () => {
    const result = parseNaturalDate('entrega no dia 5 de outubro', now);
    expect(result!.date.getDate()).toBe(5);
    expect(result!.date.getMonth()).toBe(9);
  });

  it('joga para o ano seguinte quando a data já passou', () => {
    const result = parseNaturalDate('vence em 10 de janeiro', now);
    expect(result!.date.getFullYear()).toBe(2027);
  });

  it('reconhece "em N dias" e "em N semanas"', () => {
    expect(parseNaturalDate('em 3 dias', now)!.date.getDate()).toBe(19);
    expect(parseNaturalDate('em 2 semanas', now)!.date.getDate()).toBe(30);
  });

  it('não inventa data quando não há referência temporal', () => {
    expect(parseNaturalDate('precisamos melhorar o processo', now)).toBeNull();
  });

  it('rejeita data numérica impossível', () => {
    // 32/13 não existe; não deve virar uma data qualquer.
    const result = parseNaturalDate('o código 32/13 do sistema', now);
    expect(result).toBeNull();
  });
});

describe('applyTimeOfDay', () => {
  const base = new Date(2026, 8, 18, 18, 0, 0);

  it('aplica horário explícito com "às"', () => {
    expect(applyTimeOfDay(base, 'reunião às 14h').getHours()).toBe(14);
  });

  it('aplica horário com minutos', () => {
    const result = applyTimeOfDay(base, 'começa 09:30');
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it('ignora números que não são horário', () => {
    // "5 tarefas" não pode virar 05:00.
    expect(applyTimeOfDay(base, 'temos 5 tarefas pendentes').getHours()).toBe(18);
  });
});
