import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ParseRequestSchema,
  WodSchema,
  type ExampleWod,
  type Issue,
  type Load,
  type Movement,
  type Wod,
} from '@wod-translator/shared';
import { mockParse } from '../mocks/mockParse';
import { describeFirstIssue, describeIssue } from '../utils/validationMessages';
import { fieldErrorKey, issueKey } from '../utils/fieldPath';

export type AppState = 'inicial' | 'interpretando' | 'revision_necesaria' | 'listo' | 'error';

type MetaFieldPatch = Partial<Pick<Wod, 'format' | 'durationSeconds' | 'rounds' | 'timeCapSeconds'>>;
type MovementFieldPatch = Partial<Pick<Movement, 'name' | 'quantity' | 'unit'>>;

function fieldErrorsFromCard(card: Wod): Record<string, string> {
  const result = WodSchema.safeParse(card);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = fieldErrorKey(issue.path as (string | number)[]);
    if (!(key in errors)) errors[key] = describeIssue(issue);
  }
  return errors;
}

export function useWodTranslator() {
  const [text, setTextRaw] = useState('');
  const [card, setCard] = useState<Wod | null>(null);
  const [lastInterpretedText, setLastInterpretedText] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resolvedIssueKeys, setResolvedIssueKeys] = useState<Set<string>>(new Set());
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Any action that changes text/card state must supersede an in-flight
  // interpret request — otherwise its (possibly outdated) response could
  // land later and silently overwrite newer edits.
  const supersedeInFlightRequest = useCallback(() => {
    requestSeqRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const unresolvedIssues = useMemo<Issue[]>(
    () => (card ? card.issues.filter((issue, index) => !resolvedIssueKeys.has(issueKey(issue, index))) : []),
    [card, resolvedIssueKeys],
  );

  const appState: AppState = useMemo(() => {
    if (phase === 'loading') return 'interpretando';
    if (phase === 'error') return 'error';
    if (!card) return 'inicial';
    if (isStale || unresolvedIssues.length > 0 || Object.keys(fieldErrors).length > 0) {
      return 'revision_necesaria';
    }
    return 'listo';
  }, [phase, card, isStale, unresolvedIssues, fieldErrors]);

  const setText = useCallback(
    (next: string) => {
      setTextRaw(next);
      supersedeInFlightRequest();
      if (card && next !== lastInterpretedText) {
        setIsStale(true);
      }
    },
    [card, lastInterpretedText, supersedeInFlightRequest],
  );

  const resetReviewState = useCallback(() => {
    setIsStale(false);
    setFieldErrors({});
    setResolvedIssueKeys(new Set());
  }, []);

  const interpret = useCallback(async () => {
    const parsedRequest = ParseRequestSchema.safeParse({ text });
    if (!parsedRequest.success) {
      setInputError(describeFirstIssue(parsedRequest.error.issues));
      return;
    }
    setInputError(null);
    setPhase('loading');
    setErrorMessage(null);

    supersedeInFlightRequest(); // cancel/invalidate any previous in-flight request
    const mySeq = requestSeqRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let outcome;
    try {
      outcome = await mockParse(parsedRequest.data.text, controller.signal);
    } catch {
      return; // aborted by a superseding action — that action already owns state
    }
    if (requestSeqRef.current !== mySeq) return; // belt-and-braces race guard

    if (outcome.ok) {
      setCard(outcome.card);
      setLastInterpretedText(parsedRequest.data.text);
      setActiveExampleId(null);
      resetReviewState();
      setPhase('idle');
    } else {
      setPhase('error');
      setErrorMessage(outcome.error.message);
    }
  }, [text, resetReviewState, supersedeInFlightRequest]);

  const loadExample = useCallback(
    (example: ExampleWod) => {
      supersedeInFlightRequest();
      setTextRaw(example.rawText);
      setCard(structuredClone(example.card));
      setLastInterpretedText(example.rawText);
      setActiveExampleId(example.id);
      setInputError(null);
      setErrorMessage(null);
      setPhase('idle');
      resetReviewState();
    },
    [resetReviewState, supersedeInFlightRequest],
  );

  const applyCardUpdate = useCallback(
    (updater: (draft: Wod) => Wod) => {
      if (!card) return;
      supersedeInFlightRequest(); // an edit-in-progress must win over a stale interpret response
      const next = updater(card);
      setCard(next);
      setFieldErrors(fieldErrorsFromCard(next));
    },
    [card, supersedeInFlightRequest],
  );

  const updateMetaField = useCallback(
    (patch: MetaFieldPatch) => {
      applyCardUpdate((draft) => {
        const next: Wod = { ...draft, ...patch };
        if (patch.format === 'amrap') {
          next.rounds = null;
          next.timeCapSeconds = null;
        } else if (patch.format === 'for_time') {
          next.durationSeconds = null;
        }
        return next;
      });
    },
    [applyCardUpdate],
  );

  const updateMovementField = useCallback(
    (movementId: string, patch: MovementFieldPatch) => {
      applyCardUpdate((draft) => ({
        ...draft,
        movements: draft.movements.map((movement) =>
          movement.id === movementId ? { ...movement, ...patch } : movement,
        ),
      }));
    },
    [applyCardUpdate],
  );

  const updateMovementLoads = useCallback(
    (movementId: string, loads: Load[] | null) => {
      applyCardUpdate((draft) => ({
        ...draft,
        movements: draft.movements.map((movement) => (movement.id === movementId ? { ...movement, loads } : movement)),
      }));
    },
    [applyCardUpdate],
  );

  const toggleIssueResolved = useCallback((issue: Issue, index: number) => {
    const key = issueKey(issue, index);
    setResolvedIssueKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return {
    text,
    setText,
    card,
    isStale,
    appState,
    errorMessage,
    inputError,
    fieldErrors,
    resolvedIssueKeys,
    activeExampleId,
    interpret,
    loadExample,
    updateMetaField,
    updateMovementField,
    updateMovementLoads,
    toggleIssueResolved,
  };
}
