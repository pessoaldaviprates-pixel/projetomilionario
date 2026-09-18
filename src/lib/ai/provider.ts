/**
 * Provedor de IA.
 *
 * Duas implementações por trás da MESMA interface:
 *
 *  - `heuristic` (padrão): determinístico, roda offline, sem custo e sem enviar
 *    dado nenhum para fora. É o que garante que os fluxos de IA do produto
 *    funcionem de verdade em qualquer ambiente, inclusive sem chave de API.
 *
 *  - `anthropic`: chama a API da Anthropic para gerar texto de qualidade
 *    superior (resumo, ata, respostas). Mesmo aqui, prazos e responsáveis
 *    passam pela validação determinística — LLM erra data com frequência.
 *
 * Em ambos os casos a IA apenas PROPÕE. Escrita no banco exige aprovação
 * humana explícita (ver AiAction).
 */
import 'server-only';
import { env } from '@/lib/env';
import { extractActions, type ExtractedAction, type PersonRef } from './extraction';
import { parseNaturalDate } from './dates';

export interface MeetingSummary {
  summary: string;
  decisions: string[];
  actions: ExtractedAction[];
  minutes: string;
}

export interface AnswerRequest {
  question: string;
  /** Contexto já filtrado por permissão no servidor. */
  context: string;
  history: { role: 'USER' | 'ASSISTANT'; content: string }[];
}

export interface AnswerResult {
  content: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  suggestFromText(text: string, people: PersonRef[]): Promise<ExtractedAction[]>;
  summarizeMeeting(transcript: string, people: PersonRef[], title: string): Promise<MeetingSummary>;
  answer(request: AnswerRequest): Promise<AnswerResult>;
}

// ── Heurístico ──────────────────────────────────────────────────────────────

const DECISION_PATTERNS = [
  /\b(?:decidimos|ficou decidido|foi decidido|acordamos|definimos|conclus[ãa]o|optamos por|vamos seguir com)\b/i,
  /\b(?:aprovado|aprovamos|rejeitado|cancelado|adiado)\b/i,
];

function extractDecisions(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && DECISION_PATTERNS.some((p) => p.test(s)))
    .slice(0, 12);
}

/** Resumo extractivo: frases mais informativas do texto, em ordem original. */
function extractiveSummary(transcript: string, maxSentences = 5): string {
  const sentences = transcript
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length <= maxSentences) return sentences.join(' ');

  const stopWords = new Set([
    'que', 'para', 'com', 'uma', 'dos', 'das', 'por', 'mais', 'como', 'mas', 'esse', 'essa',
    'isso', 'esta', 'este', 'não', 'sim', 'então', 'aqui', 'ali', 'pra', 'the', 'and', 'você',
  ]);

  // Pontua cada frase pela frequência das palavras que ela contém.
  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of sentence.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []) {
      if (stopWords.has(word)) continue;
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }

  const scored = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/[\p{L}]{4,}/gu) ?? [];
    const score = words.reduce((total, word) => total + (frequency.get(word) ?? 0), 0) / (words.length || 1);
    return { sentence, index, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence)
    .join(' ');
}

class HeuristicProvider implements AiProvider {
  readonly name = 'heuristic';

  async suggestFromText(text: string, people: PersonRef[]): Promise<ExtractedAction[]> {
    return extractActions(text, { people });
  }

  async summarizeMeeting(transcript: string, people: PersonRef[], title: string): Promise<MeetingSummary> {
    const summary = extractiveSummary(transcript);
    const decisions = extractDecisions(transcript);
    const actions = extractActions(transcript, { people, maxActions: 10, minConfidence: 0.5 });

    const minutes = [
      `# Ata — ${title}`,
      '',
      '## Resumo',
      summary || 'Sem conteúdo suficiente para resumir.',
      '',
      '## Decisões',
      decisions.length ? decisions.map((d) => `- ${d}`).join('\n') : '- Nenhuma decisão explícita identificada.',
      '',
      '## Itens de ação',
      actions.length
        ? actions
            .map((a) => {
              const who = a.assigneeHint ? ` — responsável: ${a.assigneeHint}` : '';
              const when = a.dueAt ? ` — prazo: ${a.dueAt.toLocaleDateString('pt-BR')}` : '';
              return `- ${a.title}${who}${when}`;
            })
            .join('\n')
        : '- Nenhum item de ação identificado.',
    ].join('\n');

    return { summary, decisions, actions, minutes };
  }

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    // Sem LLM, respondemos com os dados recuperados do tenant — que já é a
    // parte útil da pergunta ("o que tenho para hoje", "quais tarefas atrasadas").
    return {
      content: request.context.trim() || 'Não encontrei informações sobre isso no seu ambiente.',
      model: 'heuristic',
    };
  }
}

// ── Anthropic ───────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private fallback = new HeuristicProvider();

  private async complete(system: string, userContent: string, maxTokens = 1500): Promise<string> {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ai.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: env.ai.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(`Anthropic respondeu ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as { content: { type: string; text?: string }[] };
    return payload.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();
  }

  async suggestFromText(text: string, people: PersonRef[]): Promise<ExtractedAction[]> {
    // A extração estruturada permanece determinística de propósito: é ela que
    // decide prazo e responsável, onde precisão importa mais que fluência.
    return this.fallback.suggestFromText(text, people);
  }

  async summarizeMeeting(transcript: string, people: PersonRef[], title: string): Promise<MeetingSummary> {
    const heuristic = await this.fallback.summarizeMeeting(transcript, people, title);

    try {
      const system = [
        'Você é o assistente da Nexora, uma plataforma corporativa brasileira.',
        'Resuma reuniões em português do Brasil, de forma objetiva e executiva.',
        'Não invente fatos, nomes, números ou prazos que não estejam na transcrição.',
      ].join(' ');

      const content = await this.complete(
        system,
        [
          `Reunião: ${title}`,
          '',
          'Transcrição:',
          transcript.slice(0, 40_000),
          '',
          'Produza: (1) um resumo executivo de até 6 linhas; (2) a lista de decisões tomadas.',
          'Responda em markdown com as seções "## Resumo" e "## Decisões".',
        ].join('\n'),
      );

      const summaryMatch = content.match(/##\s*Resumo\s*\n([\s\S]*?)(?=\n##|$)/i);
      const decisionsMatch = content.match(/##\s*Decis[õo]es\s*\n([\s\S]*?)(?=\n##|$)/i);

      const decisions = decisionsMatch
        ? decisionsMatch[1]!
            .split('\n')
            .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
            .filter(Boolean)
        : heuristic.decisions;

      return {
        summary: summaryMatch?.[1]?.trim() || heuristic.summary,
        decisions,
        // Itens de ação continuam vindo do extrator determinístico.
        actions: heuristic.actions,
        minutes: content || heuristic.minutes,
      };
    } catch (error) {
      console.error('[ai] falha na Anthropic, usando resumo heurístico:', error);
      return heuristic;
    }
  }

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    try {
      const system = [
        'Você é o assistente da Nexora. Responda em português do Brasil, de forma direta e útil.',
        'Você SÓ pode usar os dados do contexto fornecido — eles já foram filtrados pelas permissões do usuário.',
        'Se a informação não estiver no contexto, diga que não encontrou. NUNCA invente dados.',
        'Datas devem ser escritas no formato brasileiro.',
      ].join(' ');

      const history = request.history
        .slice(-6)
        .map((m) => `${m.role === 'USER' ? 'Usuário' : 'Assistente'}: ${m.content}`)
        .join('\n');

      const content = await this.complete(
        system,
        [
          '=== CONTEXTO DO AMBIENTE (dados reais do usuário) ===',
          request.context || '(nenhum dado relevante encontrado)',
          '',
          history ? `=== HISTÓRICO ===\n${history}\n` : '',
          '=== PERGUNTA ===',
          request.question,
        ].join('\n'),
        1200,
      );

      return { content, model: env.ai.model };
    } catch (error) {
      console.error('[ai] falha na Anthropic, usando resposta heurística:', error);
      return this.fallback.answer(request);
    }
  }
}

function resolveProvider(): AiProvider {
  if (env.ai.provider === 'anthropic') {
    if (!env.ai.apiKey) {
      console.warn('[ai] AI_PROVIDER=anthropic sem ANTHROPIC_API_KEY. Usando provedor heurístico.');
      return new HeuristicProvider();
    }
    return new AnthropicProvider();
  }
  return new HeuristicProvider();
}

export const aiProvider: AiProvider = resolveProvider();

/** Normaliza uma data que veio de texto livre, recusando o que não fizer sentido. */
export function validateSuggestedDate(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime()) && direct.getFullYear() > 2000 && direct.getFullYear() < 2100) {
    return direct;
  }
  return parseNaturalDate(raw, now)?.date ?? null;
}
