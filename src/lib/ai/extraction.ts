/**
 * Extração de intenção a partir de texto (mensagens de chat, transcrições).
 *
 * É esta função que sustenta o principal diferencial do Nexora:
 * COMUNICAÇÃO → DECISÃO → TAREFA → PRAZO → EXECUÇÃO.
 *
 * Roda 100% local e determinístico. Quando `AI_PROVIDER=anthropic` o resultado
 * do LLM é MESCLADO com este (ver provider.ts) — a heurística continua sendo a
 * rede de segurança para prazo e responsável, onde modelo costuma alucinar.
 */

import { applyTimeOfDay, parseNaturalDate, type ParsedDate } from './dates';

export interface PersonRef {
  id: string;
  name: string;
}

export interface ExtractedAction {
  kind: 'CREATE_TASK' | 'CREATE_MEETING' | 'CREATE_REMINDER';
  title: string;
  assigneeId: string | null;
  assigneeHint: string | null;
  dueAt: Date | null;
  dueHint: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;
  rationale: string;
}

/** Verbos que indicam compromisso de execução. */
const COMMITMENT_PATTERNS = [
  /\bprecisamos?\b/i,
  /\bprecisa(?:mos)?\s+(?:de\s+)?/i,
  /\btemos que\b/i,
  /\bvamos\b/i,
  /\bfica(?:r[áa])?\s+respons[áa]vel\b/i,
  /\bficou\s+de\b/i,
  /\bvou\s+(?:fazer|entregar|preparar|enviar|revisar|criar|corrigir)\b/i,
  /\bpode(?:ria)?\s+(?:fazer|entregar|preparar|enviar|revisar|criar|corrigir)\b/i,
  /\bentregar\b/i,
  /\bterminar\b/i,
  /\bfinalizar\b/i,
  /\bcorrigir\b/i,
  /\bajustar\b/i,
  /\brevisar\b/i,
  /\bpreparar\b/i,
  /\benviar\b/i,
  /\bmarcar\b/i,
  /\bagendar\b/i,
  /\bnão esque[çc]a\b/i,
  /\blembrar de\b/i,
];

const MEETING_PATTERNS = [
  /\b(?:marcar|agendar|remarcar)\s+(?:uma?\s+)?(?:reuni[ãa]o|call|alinhamento|daily|review|retro)\b/i,
  /\breuni[ãa]o\s+(?:de|com|sobre)\b/i,
];

const REMINDER_PATTERNS = [/\blembr(?:ar|ete)\b/i, /\bn[ãa]o esque[çc]a\b/i];

const URGENCY_PATTERNS: { pattern: RegExp; priority: ExtractedAction['priority'] }[] = [
  { pattern: /\b(urgente|urg[êe]ncia|imediato|agora|asap|cr[íi]tico|parad[oa])\b/i, priority: 'URGENT' },
  { pattern: /\b(prioridade alta|importante|prioritário|prioritario|o quanto antes)\b/i, priority: 'HIGH' },
  { pattern: /\b(quando (?:der|puder)|sem pressa|baixa prioridade)\b/i, priority: 'LOW' },
];

/** Ruído conversacional que não deve entrar no título da tarefa. */
const TITLE_NOISE = [
  /^(?:oi|ol[áa]|bom dia|boa tarde|boa noite|pessoal|galera|equipe|time)[,!.\s]+/i,
  /^(?:ent[ãa]o|ai|a[íi]|olha|escuta|gente)[,!.\s]+/i,
  /\b(?:por favor|pfv|pls|obrigad[oa]|vlw|valeu)\b/gi,
];

function detectPriority(text: string): ExtractedAction['priority'] {
  for (const { pattern, priority } of URGENCY_PATTERNS) {
    if (pattern.test(text)) return priority;
  }
  return 'MEDIUM';
}

/**
 * Procura uma pessoa citada pelo primeiro nome.
 * Só aceita correspondência ÚNICA — com dois "João" na empresa, devolvemos a
 * dica textual e deixamos o humano escolher, em vez de atribuir para o errado.
 */
export function matchPerson(text: string, people: PersonRef[]): { person: PersonRef | null; hint: string | null } {
  const normalized = normalize(text);

  const candidates = people.filter((person) => {
    const parts = normalize(person.name).split(/\s+/).filter((p) => p.length >= 3);
    return parts.some((part) => new RegExp(`\\b${escapeRegex(part)}\\b`).test(normalized));
  });

  if (candidates.length === 1) return { person: candidates[0]!, hint: candidates[0]!.name };
  if (candidates.length > 1) {
    return { person: null, hint: candidates.map((c) => c.name).join(' ou ') };
  }
  return { person: null, hint: null };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Constrói um título curto e acionável a partir da frase original. */
export function buildTitle(sentence: string, due: ParsedDate | null): string {
  let title = sentence.trim();

  for (const noise of TITLE_NOISE) title = title.replace(noise, ' ');

  // Remove o trecho temporal: o prazo vira campo próprio, não faz parte do título.
  if (due) {
    title = title.replace(new RegExp(`(?:at[ée]\\s+|para\\s+|no\\s+|na\\s+)?${escapeRegex(due.matched)}`, 'i'), ' ');
  }

  title = title
    .replace(/^(?:precisamos?|precisa|temos que|vamos|voc[êe] pode|poderia|pode)\s+(?:de\s+)?/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:.!?-]+$/g, '')
    .trim();

  if (!title) title = sentence.trim();

  // Primeira letra maiúscula, sem alterar o resto (siglas preservadas).
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return title.length > 140 ? `${title.slice(0, 137)}…` : title;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

export interface ExtractOptions {
  people?: PersonRef[];
  now?: Date;
  /** Descarta sugestões abaixo deste limiar. */
  minConfidence?: number;
  maxActions?: number;
}

/**
 * Analisa um texto e devolve ações sugeridas.
 * NUNCA executa nada: o retorno é uma proposta que precisa de aprovação humana.
 */
export function extractActions(text: string, options: ExtractOptions = {}): ExtractedAction[] {
  const { people = [], now = new Date(), minConfidence = 0.45, maxActions = 5 } = options;

  const sentences = splitSentences(text);
  const source = sentences.length > 0 ? sentences : [text.trim()];
  const actions: ExtractedAction[] = [];

  for (const sentence of source) {
    if (sentence.length < 8) continue;

    const isMeeting = MEETING_PATTERNS.some((p) => p.test(sentence));
    const isReminder = REMINDER_PATTERNS.some((p) => p.test(sentence));
    const commitmentHits = COMMITMENT_PATTERNS.filter((p) => p.test(sentence)).length;

    if (!isMeeting && !isReminder && commitmentHits === 0) continue;

    const parsedDate = parseNaturalDate(sentence, now);
    const dueAt = parsedDate ? applyTimeOfDay(parsedDate.date, sentence) : null;
    const { person, hint } = matchPerson(sentence, people);

    // Confiança composta: sinal de compromisso + prazo + responsável identificado.
    let confidence = 0.35;
    confidence += Math.min(commitmentHits, 3) * 0.12;
    if (isMeeting) confidence += 0.2;
    if (parsedDate) confidence += parsedDate.confidence * 0.25;
    if (person) confidence += 0.15;
    confidence = Math.min(confidence, 0.97);

    if (confidence < minConfidence) continue;

    const reasons: string[] = [];
    if (commitmentHits > 0) reasons.push('verbo de compromisso');
    if (parsedDate) reasons.push(`prazo "${parsedDate.matched}"`);
    if (person) reasons.push(`responsável "${person.name}"`);
    if (isMeeting) reasons.push('menção a reunião');

    actions.push({
      kind: isMeeting ? 'CREATE_MEETING' : isReminder && !parsedDate ? 'CREATE_REMINDER' : 'CREATE_TASK',
      title: buildTitle(sentence, parsedDate),
      assigneeId: person?.id ?? null,
      assigneeHint: hint,
      dueAt,
      dueHint: parsedDate?.matched ?? null,
      priority: detectPriority(sentence),
      confidence: Number(confidence.toFixed(2)),
      rationale: `Identificado por ${reasons.join(', ')}.`,
    });

    if (actions.length >= maxActions) break;
  }

  return actions;
}
