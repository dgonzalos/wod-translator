import type Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { CURRENT_WOD_SCHEMA_VERSION, WodSchema, type ApiError, type Wod } from '@wod-translator/shared';
import { buildInterpretSystemPrompt, buildInterpretUserMessage } from './interpret-prompt.js';
import {
  REPORT_INTERPRETATION_TOOL,
  REPORT_UNSUPPORTED_FORMAT_TOOL,
  UnsupportedFormatInputSchema,
  WodInterpretationInputSchema,
  buildInterpretTools,
} from './interpret-tools.js';

// A single concrete signature (not the real `messages.create` overload set)
// — lets tests inject a plain fake function instead of constructing a real
// Anthropic client (which requires an API key even to instantiate), and
// sidesteps assigning a wrapper function to an overloaded function type.
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: Anthropic.RequestOptions,
) => Promise<Anthropic.Message>;

export type InterpretOutcome = { ok: true; card: Wod } | { ok: false; error: ApiError };

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

  async interpret(text: string, requestId: string): Promise<InterpretOutcome> {
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
        return { ok: false, error: timeoutError(requestId) };
      }
      return { ok: false, error: providerError(requestId) };
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      return { ok: false, error: providerError(requestId) };
    }

    if (toolUse.name === REPORT_UNSUPPORTED_FORMAT_TOOL) {
      const parsedReason = UnsupportedFormatInputSchema.safeParse(toolUse.input);
      // Logged for operators only — never surfaced to the user as app copy.
      console.info(`InterpretationService: unsupported format (requestId=${requestId})`, {
        reason: parsedReason.success ? parsedReason.data.reason : undefined,
      });
      return { ok: false, error: unsupportedFormatError(requestId) };
    }

    if (toolUse.name === REPORT_INTERPRETATION_TOOL) {
      const parsedInput = WodInterpretationInputSchema.safeParse(toolUse.input);
      if (!parsedInput.success) {
        return { ok: false, error: providerError(requestId, 'La respuesta de la IA no superó la validación.') };
      }
      const candidate = { schemaVersion: CURRENT_WOD_SCHEMA_VERSION, ...parsedInput.data };
      const parsedCard = WodSchema.safeParse(candidate);
      if (!parsedCard.success) {
        return { ok: false, error: providerError(requestId, 'La respuesta de la IA no superó la validación.') };
      }
      return { ok: true, card: parsedCard.data };
    }

    return { ok: false, error: providerError(requestId) };
  }
}
