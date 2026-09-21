import type Anthropic from '@anthropic-ai/sdk';
import type { CreateMessage } from './anthropic-client.js';
import { REPORT_ADAPTATION_PROPOSALS_TOOL } from './adapt-tools.js';
import { REPORT_INTERPRETATION_TOOL } from './interpret-tools.js';

function toolUseBlock(name: string, input: unknown): Anthropic.ContentBlock {
  return { type: 'tool_use', id: 'toolu_stub', name, input } as unknown as Anthropic.ContentBlock;
}

function stubMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return { content, usage: { input_tokens: 0, output_tokens: 0 } } as unknown as Anthropic.Message;
}

function extractFirstMovementId(userContent: string): string {
  const match = userContent.match(/<wod_card>\s*([\s\S]*?)\s*<\/wod_card>/);
  if (!match) return 'unknown-movement';
  try {
    const card = JSON.parse(match[1]!) as { movements?: { id?: string }[] };
    return card.movements?.[0]?.id ?? 'unknown-movement';
  } catch {
    return 'unknown-movement';
  }
}

/**
 * Canned AI responses, gated behind AI_STUB_MODE — never set this env var in
 * a real deployment. Lets the E2E suite (packages/e2e) exercise the full
 * adapt/save/reload/copy flow deterministically, with no ANTHROPIC_API_KEY
 * and no real provider call.
 */
export function createStubMessageFn(): CreateMessage {
  return async (params) => {
    const firstTool = params.tools?.[0];
    const toolName = firstTool && 'name' in firstTool ? firstTool.name : undefined;

    if (toolName === REPORT_ADAPTATION_PROPOSALS_TOOL) {
      const userMessage = params.messages[0];
      const content = typeof userMessage?.content === 'string' ? userMessage.content : '';
      return stubMessage([
        toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, {
          proposals: [
            {
              movementId: extractFirstMovementId(content),
              substitute: 'Sustituto simulado (E2E)',
              requiredEquipment: [],
              reason: 'Propuesta generada por el modo de pruebas E2E, no por el modelo real.',
              caveats: null,
            },
          ],
        }),
      ]);
    }

    // Interpret path: kept for completeness. The golden-path E2E test starts
    // from a precomputed example and never calls /api/parse, so this branch
    // isn't exercised by that test today, but keeps the stub usable for a
    // future E2E test that types a WOD in manually.
    return stubMessage([
      toolUseBlock(REPORT_INTERPRETATION_TOOL, {
        format: 'amrap',
        durationSeconds: 600,
        rounds: null,
        timeCapSeconds: null,
        movements: [
          {
            id: 'stub-movement-1',
            name: 'Burpees',
            quantity: 10,
            unit: 'reps',
            loads: null,
            originalTextSnippet: '10 burpees',
          },
        ],
        explanations: [],
        issues: [],
      }),
    ]);
  };
}
