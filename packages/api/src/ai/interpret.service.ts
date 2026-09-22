import type Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { CURRENT_WOD_SCHEMA_VERSION, WodSchema, type ApiError, type Wod } from '@wod-translator/shared';
import type { CreateMessage } from './anthropic-client.js';
import { buildInterpretSystemPrompt, buildInterpretUserMessage } from './interpret-prompt.js';
import {
  REPORT_INTERPRETATION_TOOL,
  REPORT_UNSUPPORTED_FORMAT_TOOL,
  UnsupportedFormatInputSchema,
  WodInterpretationInputSchema,
  buildInterpretTools,
} from './interpret-tools.js';
import { noopLogger, usageOf, type AiUsage, type InfoLogger } from './usage-logging.js';

export type { CreateMessage };

export type InterpretOutcome = (
  | { ok: true; card: Wod }
  | { ok: false; error: ApiError }
) & { usage?: AiUsage };

const MAX_OUTPUT_TOKENS = 4096;

function unsupportedFormatError(requestId: string): ApiError {
  return {
    code: 'UNSUPPORTED_FORMAT',
    message: 'Este formato no está soportado todavía. Se conserva el texto original para su edición.',
    requestId,
  };
}

function providerError(requestId: string, message = 'El proveedor de IA no respondió correctamente.'): ApiError {
  return { code: 'PROVIDER_ERROR', message, requestId };
}

function timeoutError(requestId: string): ApiError {
  return { code: 'TIMEOUT', message: 'La interpretación tardó demasiado. Inténtalo de nuevo.', requestId };
}

export class InterpretationService {
  constructor(
    private readonly createMessage: CreateMessage,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async interpret(text: string, requestId: string, logger: InfoLogger = noopLogger): Promise<InterpretOutcome> {
    const startedAt = Date.now();
    // Never logs `text` or the resulting card — only counts/codes (spec §10 privacy requirement).
    function finish(outcome: InterpretOutcome, response?: Anthropic.Message): InterpretOutcome {
      const usage = response ? usageOf(response) : undefined;
      logger.info(
        {
          operation: 'interpret',
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
          system: buildInterpretSystemPrompt(),
          tools: buildInterpretTools(),
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: buildInterpretUserMessage(text) }],
        },
        { timeout: this.timeoutMs },
      );
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        return finish({ ok: false, error: timeoutError(requestId) });
      }
      // Logged for operators only — never surfaced to the user, and never
      // includes the WOD text, only the SDK error's own name/message.
      console.error(`InterpretationService: provider call failed (requestId=${requestId})`, {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      return finish({ ok: false, error: providerError(requestId) });
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      return finish({ ok: false, error: providerError(requestId) }, response);
    }

    if (toolUse.name === REPORT_UNSUPPORTED_FORMAT_TOOL) {
      const parsedReason = UnsupportedFormatInputSchema.safeParse(toolUse.input);
      // Logged for operators only — never surfaced to the user as app copy.
      console.info(`InterpretationService: unsupported format (requestId=${requestId})`, {
        reason: parsedReason.success ? parsedReason.data.reason : undefined,
      });
      return finish({ ok: false, error: unsupportedFormatError(requestId) }, response);
    }

    if (toolUse.name === REPORT_INTERPRETATION_TOOL) {
      const parsedInput = WodInterpretationInputSchema.safeParse(toolUse.input);
      if (!parsedInput.success) {
        return finish(
          { ok: false, error: providerError(requestId, 'La respuesta de la IA no superó la validación.') },
          response,
        );
      }
      const candidate = { schemaVersion: CURRENT_WOD_SCHEMA_VERSION, ...parsedInput.data };
      const parsedCard = WodSchema.safeParse(candidate);
      if (!parsedCard.success) {
        return finish(
          { ok: false, error: providerError(requestId, 'La respuesta de la IA no superó la validación.') },
          response,
        );
      }
      return finish({ ok: true, card: parsedCard.data }, response);
    }

    return finish({ ok: false, error: providerError(requestId) }, response);
  }
}
