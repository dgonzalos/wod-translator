import type Anthropic from '@anthropic-ai/sdk';

// A single concrete signature (not the real `messages.create` overload set)
// — lets tests inject a plain fake function instead of constructing a real
// Anthropic client (which requires an API key even to instantiate), and
// sidesteps assigning a wrapper function to an overloaded function type.
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: Anthropic.RequestOptions,
) => Promise<Anthropic.Message>;
