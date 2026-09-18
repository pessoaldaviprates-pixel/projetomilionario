import { describe, expect, it } from 'vitest';
import { colorFromId, formatDueLabel, initials, pluralize, truncate } from '@/lib/utils/format';
import { projectKeyFrom, slugify } from '@/lib/utils/slug';

describe('formatDueLabel', () => {
  const now = new Date(2026, 8, 16, 12, 0, 0);

  it('classifica prazos relativos ao dia atual', () => {
    expect(formatDueLabel(new Date(2026, 8, 16, 18), now)).toEqual({ label: 'Hoje', tone: 'warning' });
    expect(formatDueLabel(new Date(2026, 8, 17, 18), now)).toEqual({ label: 'Amanhã', tone: 'warning' });
    expect(formatDueLabel(new Date(2026, 8, 15, 18), now)).toEqual({ label: 'Atrasada 1 dia', tone: 'danger' });
    expect(formatDueLabel(new Date(2026, 8, 13, 18), now)).toEqual({ label: 'Atrasada 3 dias', tone: 'danger' });
  });

  it('trata ausência de prazo', () => {
    expect(formatDueLabel(null, now)).toEqual({ label: 'Sem prazo', tone: 'neutral' });
  });

  it('considera o dia inteiro, não o horário exato', () => {
    // 23:59 de hoje ainda é "Hoje", não "Atrasada".
    expect(formatDueLabel(new Date(2026, 8, 16, 0, 1), now).label).toBe('Hoje');
  });
});

describe('pluralize', () => {
  it('escolhe singular e plural corretamente', () => {
    expect(pluralize(1, 'tarefa', 'tarefas')).toBe('1 tarefa');
    expect(pluralize(0, 'tarefa', 'tarefas')).toBe('0 tarefas');
    expect(pluralize(5, 'tarefa', 'tarefas')).toBe('5 tarefas');
  });
});

describe('initials', () => {
  it('usa primeira e última palavra', () => {
    expect(initials('Prates Gabriel')).toBe('PG');
    expect(initials('Maria da Silva Souza')).toBe('MS');
  });

  it('lida com nome único e vazio', () => {
    expect(initials('Ana')).toBe('AN');
    expect(initials('   ')).toBe('?');
  });
});

describe('colorFromId', () => {
  it('é determinístico', () => {
    expect(colorFromId('abc')).toBe(colorFromId('abc'));
  });

  it('devolve sempre uma cor válida', () => {
    for (const id of ['a', 'bb', 'ccc', 'zzzzzzzz']) {
      expect(colorFromId(id)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('slugify', () => {
  it('remove acentos e normaliza separadores', () => {
    expect(slugify('Ação & Estratégia')).toBe('acao-estrategia');
    expect(slugify('  Espaços   Múltiplos  ')).toBe('espacos-multiplos');
  });

  it('limita o comprimento', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('projectKeyFrom', () => {
  it('monta sigla a partir das iniciais', () => {
    expect(projectKeyFrom('Novo Site Institucional')).toBe('NSI');
  });

  it('tem fallback para nomes curtos', () => {
    expect(projectKeyFrom('App').length).toBeGreaterThan(0);
  });
});

describe('truncate', () => {
  it('encurta apenas quando necessário', () => {
    expect(truncate('curto', 10)).toBe('curto');
    expect(truncate('uma frase bem longa', 10)).toHaveLength(10);
  });
});
