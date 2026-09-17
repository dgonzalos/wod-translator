import { describe, expect, it } from 'vitest';
import { EXAMPLE_WODS, ExampleWodSchema } from './index.js';

describe('EXAMPLE_WODS', () => {
  it('contains exactly three examples', () => {
    expect(EXAMPLE_WODS).toHaveLength(3);
  });

  it.each(EXAMPLE_WODS.map((example) => [example.id, example]))(
    '%s validates against ExampleWodSchema',
    (_id, example) => {
      expect(ExampleWodSchema.safeParse(example).success).toBe(true);
    },
  );

  it('has unique ids', () => {
    const ids = EXAMPLE_WODS.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
