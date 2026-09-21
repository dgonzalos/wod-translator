import { describe, expect, it } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import { createStubMessageFn } from './stub-client.js';
import { buildAdaptSystemPrompt, buildAdaptUserMessage } from './adapt-prompt.js';
import { buildAdaptTools, REPORT_ADAPTATION_PROPOSALS_TOOL } from './adapt-tools.js';

const card: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 600,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    { id: 'movement-x', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
  ],
  explanations: [],
  issues: [],
};

describe('createStubMessageFn', () => {
  it('returns a canned adaptation proposal referencing the given card\'s first movement id', async () => {
    const createMessage = createStubMessageFn();
    const response = await createMessage({
      model: 'stub-model',
      max_tokens: 100,
      system: buildAdaptSystemPrompt(),
      tools: buildAdaptTools(),
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: buildAdaptUserMessage(card, { equipment: [], availableLoadsKg: null }) }],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    expect(toolUse?.name).toBe(REPORT_ADAPTATION_PROPOSALS_TOOL);
    const input = toolUse?.input as { proposals: { movementId: string }[] };
    expect(input.proposals[0]?.movementId).toBe('movement-x');
  });
});
