import { describe, expect, it } from 'vitest';
import { buildTitle, extractActions, matchPerson } from '@/lib/ai/extraction';
import { parseNaturalDate } from '@/lib/ai/dates';

const PEOPLE = [
  { id: 'm1', name: 'João Silva' },
  { id: 'm2', name: 'Maria Souza' },
  { id: 'm3', name: 'João Pereira' },
];

const NOW = new Date(2026, 8, 16, 12, 0, 0);

describe('matchPerson', () => {
  it('encontra pessoa pelo primeiro nome quando é único', () => {
    const { person } = matchPerson('Maria vai cuidar disso', PEOPLE);
    expect(person?.id).toBe('m2');
  });

  it('não escolhe ninguém quando o nome é ambíguo', () => {
    // Existem dois "João": atribuir automaticamente seria arriscar o errado.
    const { person, hint } = matchPerson('João fica responsável', PEOPLE);
    expect(person).toBeNull();
    expect(hint).toContain('João Silva');
    expect(hint).toContain('João Pereira');
  });

  it('ignora acentuação na comparação', () => {
    const { person } = matchPerson('a maria assume', PEOPLE);
    expect(person?.id).toBe('m2');
  });

  it('não encontra ninguém quando não há menção', () => {
    expect(matchPerson('precisamos revisar o texto', PEOPLE).person).toBeNull();
  });
});

describe('buildTitle', () => {
  it('remove o trecho de prazo do título', () => {
    const sentence = 'Precisamos terminar a apresentação para sexta-feira';
    const due = parseNaturalDate(sentence, NOW);
    const title = buildTitle(sentence, due);

    expect(title.toLowerCase()).not.toContain('sexta');
    expect(title.toLowerCase()).toContain('apresentação');
  });

  it('remove verbo de compromisso do início', () => {
    expect(buildTitle('Precisamos revisar o contrato', null)).toBe('Revisar o contrato');
  });

  it('nunca devolve título vazio', () => {
    expect(buildTitle('Precisamos', null).length).toBeGreaterThan(0);
  });
});

describe('extractActions', () => {
  it('extrai tarefa com prazo a partir de uma mensagem de chat', () => {
    const actions = extractActions(
      'Precisamos terminar a apresentação para sexta-feira.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('CREATE_TASK');
    expect(actions[0]!.dueAt).not.toBeNull();
    expect(actions[0]!.dueAt!.getDate()).toBe(18);
  });

  it('identifica responsável quando o nome é inequívoco', () => {
    const actions = extractActions(
      'Maria fica responsável pelo novo site até sexta.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions[0]!.assigneeId).toBe('m2');
    expect(actions[0]!.dueAt).not.toBeNull();
  });

  it('não atribui responsável quando o nome é ambíguo', () => {
    const actions = extractActions(
      'João fica responsável pelo novo site até sexta.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions[0]!.assigneeId).toBeNull();
    expect(actions[0]!.assigneeHint).toContain('ou');
  });

  it('detecta urgência e eleva a prioridade', () => {
    const actions = extractActions(
      'Precisamos corrigir o problema do cliente, é urgente.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions[0]!.priority).toBe('URGENT');
  });

  it('reconhece intenção de agendar reunião', () => {
    const actions = extractActions(
      'Vamos marcar uma reunião de alinhamento na quinta.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions[0]!.kind).toBe('CREATE_MEETING');
  });

  it('ignora conversa que não contém compromisso', () => {
    const actions = extractActions(
      'Bom dia pessoal! Tudo certo por aí? O café de hoje está ótimo.',
      { people: PEOPLE, now: NOW },
    );

    expect(actions).toHaveLength(0);
  });

  it('confia mais quando há prazo e responsável identificados', () => {
    const completo = extractActions('Maria entrega o relatório até sexta.', { people: PEOPLE, now: NOW });
    const vago = extractActions('Precisamos revisar isso.', { people: PEOPLE, now: NOW });

    expect(completo[0]!.confidence).toBeGreaterThan(vago[0]?.confidence ?? 0);
  });

  it('extrai múltiplas ações de uma transcrição', () => {
    const transcript = [
      'Lucas: Precisamos corrigir o bug do cliente até sexta.',
      'Maria: Eu vou preparar o relatório mensal amanhã.',
      'Lucas: Vamos marcar uma reunião de revisão na quinta.',
    ].join('\n');

    const actions = extractActions(transcript, { people: PEOPLE, now: NOW });
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it('respeita o limite máximo de sugestões', () => {
    const repeated = Array.from({ length: 20 }, (_, i) => `Precisamos entregar a tarefa ${i} amanhã.`).join(' ');
    const actions = extractActions(repeated, { people: PEOPLE, now: NOW, maxActions: 3 });

    expect(actions.length).toBeLessThanOrEqual(3);
  });
});
