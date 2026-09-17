import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION, EXAMPLE_WODS, type Wod } from '@wod-translator/shared';
import { useWodTranslator } from './useWodTranslator';
import { mockParse } from '../mocks/mockParse';

vi.mock('../mocks/mockParse', () => ({
  mockParse: vi.fn(),
}));

const mockedMockParse = vi.mocked(mockParse);

const cardWithIssue: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 600,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    {
      id: 'movement-1',
      name: 'Burpees',
      quantity: 10,
      unit: 'reps',
      loads: null,
      originalTextSnippet: '10 burpees',
    },
  ],
  explanations: [],
  issues: [{ field: 'movements[0].quantity', message: 'Revisa esta cantidad.' }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useWodTranslator', () => {
  beforeEach(() => {
    mockedMockParse.mockReset();
  });

  it('starts in the inicial state', () => {
    const { result } = renderHook(() => useWodTranslator());
    expect(result.current.appState).toBe('inicial');
    expect(result.current.card).toBeNull();
  });

  it('loadExample sets the card without calling mockParse', () => {
    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.loadExample(EXAMPLE_WODS[0]);
    });
    expect(result.current.card).toEqual(EXAMPLE_WODS[0].card);
    expect(mockedMockParse).not.toHaveBeenCalled();
  });

  it('reaches the error state with UNSUPPORTED_FORMAT for EMOM text', async () => {
    mockedMockParse.mockResolvedValue({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: 'no soportado', requestId: 'req-1' },
    });
    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.setText('EMOM 20min: 5 pull-ups');
    });
    await act(async () => {
      await result.current.interpret();
    });
    expect(result.current.appState).toBe('error');
    expect(result.current.errorMessage).toBe('no soportado');
  });

  it('reaches revision_necesaria when the card has an unresolved issue', async () => {
    mockedMockParse.mockResolvedValue({ ok: true, requestId: 'req-1', card: cardWithIssue });
    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.setText('AMRAP 10min: 10 burpees');
    });
    await act(async () => {
      await result.current.interpret();
    });
    expect(result.current.appState).toBe('revision_necesaria');
  });

  it('reaches listo once the only issue is resolved', async () => {
    mockedMockParse.mockResolvedValue({ ok: true, requestId: 'req-1', card: cardWithIssue });
    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.setText('AMRAP 10min: 10 burpees');
    });
    await act(async () => {
      await result.current.interpret();
    });
    act(() => {
      result.current.toggleIssueResolved(cardWithIssue.issues[0], 0);
    });
    expect(result.current.appState).toBe('listo');
  });

  it('marks the card stale when the text changes after a card exists', () => {
    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.loadExample(EXAMPLE_WODS[0]);
    });
    act(() => {
      result.current.setText(`${EXAMPLE_WODS[0].rawText} extra`);
    });
    expect(result.current.isStale).toBe(true);
    expect(result.current.appState).toBe('revision_necesaria');
  });

  it('discards a superseded interpret response instead of overwriting newer state', async () => {
    const first = deferred<Awaited<ReturnType<typeof mockParse>>>();
    mockedMockParse.mockReturnValueOnce(first.promise);

    const { result } = renderHook(() => useWodTranslator());
    act(() => {
      result.current.setText('AMRAP 10min: 10 burpees');
    });

    let interpretPromise!: Promise<void>;
    act(() => {
      interpretPromise = result.current.interpret();
    });

    // Superseding edit while the first request is still in flight.
    act(() => {
      result.current.setText('a completely different workout');
    });

    await act(async () => {
      first.resolve({ ok: true, requestId: 'req-1', card: cardWithIssue });
      await interpretPromise;
    });

    expect(result.current.card).toBeNull();
    expect(result.current.text).toBe('a completely different workout');
  });

  it('does not let a stale response overwrite a card edit made while it was in flight', async () => {
    const { result } = renderHook(() => useWodTranslator());

    // First interpret populates a card (text stays unchanged going forward).
    mockedMockParse.mockResolvedValueOnce({ ok: true, requestId: 'req-1', card: cardWithIssue });
    act(() => {
      result.current.setText('AMRAP 10min: 10 burpees');
    });
    await act(async () => {
      await result.current.interpret();
    });

    // Re-interpret the same text (e.g. the user clicks "Interpretar" again).
    const second = deferred<Awaited<ReturnType<typeof mockParse>>>();
    mockedMockParse.mockReturnValueOnce(second.promise);
    let secondInterpretPromise!: Promise<void>;
    act(() => {
      secondInterpretPromise = result.current.interpret();
    });

    // While that request is in flight, the user edits a movement field —
    // isStale never becomes true here (the text didn't change), so this
    // edit must still supersede the pending response on its own.
    act(() => {
      result.current.updateMovementField('movement-1', { name: 'Edited during interpret' });
    });

    await act(async () => {
      second.resolve({ ok: true, requestId: 'req-2', card: cardWithIssue });
      await secondInterpretPromise;
    });

    expect(result.current.card?.movements[0].name).toBe('Edited during interpret');
  });
});
