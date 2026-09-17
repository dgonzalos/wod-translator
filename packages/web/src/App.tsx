import { EXAMPLE_WODS } from '@wod-translator/shared';
import { useWodTranslator } from './hooks/useWodTranslator';
import { EntradaPanel } from './components/wod/EntradaPanel';
import { RevisionPanel } from './components/wod/RevisionPanel';
import styles from './App.module.css';

export function App() {
  const wt = useWodTranslator();

  return (
    <main className={styles.app}>
      <h1 className={styles.title}>WOD Translator</h1>
      <div className={styles.columns}>
        <EntradaPanel
          text={wt.text}
          onTextChange={wt.setText}
          onSubmit={wt.interpret}
          onSelectExample={wt.loadExample}
          examples={EXAMPLE_WODS}
          isSubmitting={wt.appState === 'interpretando'}
          inputError={wt.inputError}
          activeExampleId={wt.activeExampleId}
        />
        <RevisionPanel
          card={wt.card}
          isStale={wt.isStale}
          appState={wt.appState}
          errorMessage={wt.errorMessage}
          fieldErrors={wt.fieldErrors}
          resolvedIssueKeys={wt.resolvedIssueKeys}
          onMetaFieldChange={wt.updateMetaField}
          onMovementFieldChange={wt.updateMovementField}
          onMovementLoadsChange={wt.updateMovementLoads}
          onToggleIssueResolved={wt.toggleIssueResolved}
        />
      </div>
    </main>
  );
}
