import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  ParseRequestSchema,
  WodSchema,
  type AdaptationProposal,
  type EquipmentSelection,
  type ExampleWod,
  type Issue,
  type Load,
  type Movement,
  type SavedWodEnvelope,
  type Wod,
} from '@wod-translator/shared';
import { parseWod } from '../api/parseWod';
import { adaptWod } from '../api/adaptWod';
import { clearSavedWod, loadSavedWod, saveWod } from '../storage/localWodStorage';
import { describeFirstIssue, describeIssue } from '../utils/validationMessages';
import { fieldErrorKey, issueKey, proposalKey } from '../utils/fieldPath';

export type AppState = 'inicial' | 'interpretando' | 'revision_necesaria' | 'listo' | 'adaptando' | 'error';

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

  const [equipment, setEquipmentRaw] = useState<string[]>([]);
  const [availableLoadsKg, setAvailableLoadsKgRaw] = useState<number[] | null>(null);
  const [proposals, setProposals] = useState<AdaptationProposal[]>([]);
  const [acceptedProposalKeys, setAcceptedProposalKeys] = useState<Set<string>>(new Set());
  const [adaptPhase, setAdaptPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [adaptErrorMessage, setAdaptErrorMessage] = useState<string | null>(null);
  const [restoreBanner, setRestoreBanner] = useState<SavedWodEnvelope | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const adaptRequestSeqRef = useRef(0);
  const adaptAbortControllerRef = useRef<AbortController | null>(null);

  const clearAdaptationResults = useCallback(() => {
    setProposals([]);
    setAcceptedProposalKeys(new Set());
  }, []);

  // Any action that changes text/card state must supersede an in-flight
  // interpret or adapt request — otherwise its (possibly outdated) response
  // could land later and silently overwrite newer edits — and must discard
  // any adaptation proposals, which were computed for a card/text that no
  // longer exists (spec §5: editing the card after requesting an adaptation
  // invalidates that adaptation).
  const supersedeInFlight = useCallback(() => {
    requestSeqRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    adaptRequestSeqRef.current += 1;
    adaptAbortControllerRef.current?.abort();
    adaptAbortControllerRef.current = null;
    setAdaptPhase('idle');
    setAdaptErrorMessage(null);
    clearAdaptationResults();
  }, [clearAdaptationResults]);

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
    if (adaptPhase === 'loading') return 'adaptando';
    return 'listo';
  }, [phase, card, isStale, unresolvedIssues, fieldErrors, adaptPhase]);

  const setText = useCallback(
    (next: string) => {
      setTextRaw(next);
      supersedeInFlight();
      if (card && next !== lastInterpretedText) {
        setIsStale(true);
      }
    },
    [card, lastInterpretedText, supersedeInFlight],
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

    supersedeInFlight(); // cancel/invalidate any previous in-flight request, discard stale proposals
    const mySeq = requestSeqRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let outcome;
    try {
      outcome = await parseWod(parsedRequest.data.text, controller.signal);
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
  }, [text, resetReviewState, supersedeInFlight]);

  const loadExample = useCallback(
    (example: ExampleWod) => {
      supersedeInFlight();
      setTextRaw(example.rawText);
      setCard(structuredClone(example.card));
      setLastInterpretedText(example.rawText);
      setActiveExampleId(example.id);
      setInputError(null);
      setErrorMessage(null);
      setPhase('idle');
      resetReviewState();
    },
    [resetReviewState, supersedeInFlight],
  );

  const applyCardUpdate = useCallback(
    (updater: (draft: Wod) => Wod) => {
      if (!card) return;
      supersedeInFlight(); // an edit-in-progress must win over a stale interpret/adapt response
      const next = updater(card);
      setCard(next);
      setFieldErrors(fieldErrorsFromCard(next));
    },
    [card, supersedeInFlight],
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

  const setEquipment = useCallback(
    (next: string[]) => {
      setEquipmentRaw(next);
      clearAdaptationResults(); // proposals were computed for the previous equipment selection
    },
    [clearAdaptationResults],
  );

  const setAvailableLoadsKg = useCallback(
    (next: number[] | null) => {
      setAvailableLoadsKgRaw(next);
      clearAdaptationResults();
    },
    [clearAdaptationResults],
  );

  const adapt = useCallback(async () => {
    if (!card || appState !== 'listo') return;
    setAdaptPhase('loading');
    setAdaptErrorMessage(null);

    // Its own seq/controller, independent of interpret's — starting a second
    // adapt call supersedes the first without touching interpret state or
    // clearing the proposals it's about to replace.
    adaptRequestSeqRef.current += 1;
    adaptAbortControllerRef.current?.abort();
    const mySeq = adaptRequestSeqRef.current;
    const controller = new AbortController();
    adaptAbortControllerRef.current = controller;

    const equipmentSelection: EquipmentSelection = { equipment, availableLoadsKg };

    let outcome;
    try {
      outcome = await adaptWod(card, equipmentSelection, controller.signal);
    } catch {
      return; // aborted by a superseding action
    }
    if (adaptRequestSeqRef.current !== mySeq) return;

    if (outcome.ok) {
      setProposals(outcome.proposals);
      setAcceptedProposalKeys(new Set());
      setAdaptPhase('idle');
    } else {
      setAdaptPhase('error');
      setAdaptErrorMessage(outcome.error.message);
    }
  }, [card, appState, equipment, availableLoadsKg]);

  const toggleProposalAccepted = useCallback((proposal: AdaptationProposal) => {
    const key = proposalKey(proposal);
    setAcceptedProposalKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const acceptedProposals = useMemo(
    () => proposals.filter((proposal) => acceptedProposalKeys.has(proposalKey(proposal))),
    [proposals, acceptedProposalKeys],
  );

  const saveCurrentWod = useCallback((): { ok: true } | { ok: false; message: string } => {
    if (!card) return { ok: false, message: 'No hay ninguna ficha para guardar.' };
    const envelope: SavedWodEnvelope = {
      schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
      originalText: text,
      reviewedCard: card,
      acceptedProposals,
      savedAt: new Date().toISOString(),
    };
    return saveWod(envelope);
  }, [card, text, acceptedProposals]);

  const clearSaved = useCallback(() => {
    clearSavedWod();
    setRestoreBanner(null);
  }, []);

  const restoreFromSaved = useCallback(() => {
    if (!restoreBanner) return;
    const envelope = restoreBanner;
    supersedeInFlight();
    setTextRaw(envelope.originalText);
    setCard(envelope.reviewedCard);
    setLastInterpretedText(envelope.originalText);
    setActiveExampleId(null);
    setInputError(null);
    setErrorMessage(null);
    setPhase('idle');
    resetReviewState();
    setProposals(envelope.acceptedProposals);
    setAcceptedProposalKeys(new Set(envelope.acceptedProposals.map(proposalKey)));
    setRestoreBanner(null);
  }, [restoreBanner, resetReviewState, supersedeInFlight]);

  // Runs once on mount — checks for a WOD saved in a previous visit (spec
  // §7/RF-09). A corrupt or incompatible entry is reset automatically with a
  // one-line notice; there's nothing recoverable in it to offer instead.
  useEffect(() => {
    const result = loadSavedWod();
    if (result.status === 'ok') {
      setRestoreBanner(result.envelope);
    } else if (result.status === 'invalid') {
      clearSavedWod();
      setStorageNotice('Se descartó un WOD guardado dañado o de una versión incompatible.');
    }
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
    equipment,
    setEquipment,
    availableLoadsKg,
    setAvailableLoadsKg,
    proposals,
    acceptedProposalKeys,
    acceptedProposals,
    adaptPhase,
    adaptErrorMessage,
    adapt,
    toggleProposalAccepted,
    saveCurrentWod,
    restoreBanner,
    restoreFromSaved,
    storageNotice,
    clearSaved,
  };
}
