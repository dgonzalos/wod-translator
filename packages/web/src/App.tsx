import { EXAMPLE_WODS } from '@wod-translator/shared';
import { useWodTranslator } from './hooks/useWodTranslator';
import { EntradaPanel } from './components/wod/EntradaPanel';
import { RevisionPanel } from './components/wod/RevisionPanel';
import { AdaptacionPanel } from './components/wod/AdaptacionPanel';
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
      <AdaptacionPanel
        card={wt.card}
        appState={wt.appState}
        equipment={wt.equipment}
        onEquipmentChange={wt.setEquipment}
        availableLoadsKg={wt.availableLoadsKg}
        onAvailableLoadsKgChange={wt.setAvailableLoadsKg}
        proposals={wt.proposals}
        acceptedProposalKeys={wt.acceptedProposalKeys}
        onToggleProposalAccepted={wt.toggleProposalAccepted}
        adaptPhase={wt.adaptPhase}
        adaptErrorMessage={wt.adaptErrorMessage}
        onAdapt={wt.adapt}
        acceptedProposals={wt.acceptedProposals}
        onSave={wt.saveCurrentWod}
        restoreBanner={wt.restoreBanner}
        onRestore={wt.restoreFromSaved}
        storageNotice={wt.storageNotice}
        onClearSaved={wt.clearSaved}
      />
    </main>
  );
}
