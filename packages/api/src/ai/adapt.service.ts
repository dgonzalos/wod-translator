import type Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { EQUIPMENT_CATALOG, type AdaptationProposal, type ApiError, type EquipmentSelection, type Wod } from '@wod-translator/shared';
import { buildAdaptSystemPrompt, buildAdaptUserMessage } from './adapt-prompt.js';
import { AdaptationProposalsInputSchema, REPORT_ADAPTATION_PROPOSALS_TOOL, buildAdaptTools } from './adapt-tools.js';
import type { CreateMessage } from './anthropic-client.js';
import { noopLogger, usageOf, type AiUsage, type InfoLogger } from './usage-logging.js';

export type AdaptOutcome = (
  | { ok: true; proposals: AdaptationProposal[] }
  | { ok: false; error: ApiError }
) & { usage?: AiUsage };

const MAX_OUTPUT_TOKENS = 4096;
const EQUIPMENT_CATALOG_SET: ReadonlySet<string> = new Set(EQUIPMENT_CATALOG);

function providerError(requestId: string, message = 'El proveedor de IA no respondió correctamente.'): ApiError {
  return { code: 'PROVIDER_ERROR', message, requestId };
}

function timeoutError(requestId: string): ApiError {
  return { code: 'TIMEOUT', message: 'La adaptación tardó demasiado. Inténtalo de nuevo.', requestId };
}

export class AdaptationService {
  constructor(
    private readonly createMessage: CreateMessage,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async adapt(
    card: Wod,
    equipment: EquipmentSelection,
    requestId: string,
    logger: InfoLogger = noopLogger,
  ): Promise<AdaptOutcome> {
    const startedAt = Date.now();
    // Never logs the card or declared equipment — only counts/codes (spec §10 privacy requirement).
    function finish(outcome: AdaptOutcome, response?: Anthropic.Message): AdaptOutcome {
      const usage = response ? usageOf(response) : undefined;
      logger.info(
        {
          operation: 'adapt',
          requestId,
          latencyMs: Date.now() - startedAt,
          result: outcome.ok ? 'success' : outcome.error.code,
          usage,
        },
        'ai_request',
      );
      return usage ? { ...outcome, usage } : outcome;
    }

    let response: Anthropic.Message;
    try {
      response = await this.createMessage(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: buildAdaptSystemPrompt(),
          tools: buildAdaptTools(),
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: buildAdaptUserMessage(card, equipment) }],
        },
        { timeout: this.timeoutMs },
      );
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        return finish({ ok: false, error: timeoutError(requestId) });
      }
      return finish({ ok: false, error: providerError(requestId) });
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse || toolUse.name !== REPORT_ADAPTATION_PROPOSALS_TOOL) {
      return finish({ ok: false, error: providerError(requestId) }, response);
    }

    const parsedInput = AdaptationProposalsInputSchema.safeParse(toolUse.input);
    if (!parsedInput.success) {
      return finish(
        { ok: false, error: providerError(requestId, 'La respuesta de la IA no superó la validación.') },
        response,
      );
    }

    // Spec §9: unverifiable/unknown equipment alternatives are rejected, not
    // auto-accepted — drop any proposal that strays outside the catalog the
    // model was given, rather than failing the whole request.
    const proposals = parsedInput.data.proposals.filter((proposal) =>
      proposal.requiredEquipment.every((item) => EQUIPMENT_CATALOG_SET.has(item)),
    );

    return finish({ ok: true, proposals }, response);
  }
}
