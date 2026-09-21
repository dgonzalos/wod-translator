import { useState } from 'react';
import { EQUIPMENT_CATALOG, type AdaptationProposal, type SavedWodEnvelope, type Wod } from '@wod-translator/shared';
import { Button, Card, StatusMessage, Tag } from '../ui';
import type { AppState } from '../../hooks/useWodTranslator';
import { formatWodSummary } from '../../utils/formatWodSummary';
import { proposalKey } from '../../utils/fieldPath';
import styles from './AdaptacionPanel.module.css';

const DEFAULT_LOAD_KG = 20;

export interface AdaptacionPanelProps {
  card: Wod | null;
  appState: AppState;
  equipment: string[];
  onEquipmentChange: (equipment: string[]) => void;
  availableLoadsKg: number[] | null;
  onAvailableLoadsKgChange: (loads: number[] | null) => void;
  proposals: AdaptationProposal[];
  acceptedProposalKeys: Set<string>;
  onToggleProposalAccepted: (proposal: AdaptationProposal) => void;
  adaptPhase: 'idle' | 'loading' | 'error';
  adaptErrorMessage: string | null;
  onAdapt: () => void;
  acceptedProposals: AdaptationProposal[];
  onSave: () => { ok: true } | { ok: false; message: string };
  restoreBanner: SavedWodEnvelope | null;
  onRestore: () => void;
  storageNotice: string | null;
  onClearSaved: () => void;
}

export function AdaptacionPanel({
  card,
  appState,
  equipment,
  onEquipmentChange,
  availableLoadsKg,
  onAvailableLoadsKgChange,
  proposals,
  acceptedProposalKeys,
  onToggleProposalAccepted,
  adaptPhase,
  adaptErrorMessage,
  onAdapt,
  acceptedProposals,
  onSave,
  restoreBanner,
  onRestore,
  storageNotice,
  onClearSaved,
}: AdaptacionPanelProps) {
  const [copyFallbackText, setCopyFallbackText] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const hasCard = card !== null;
  const canAdapt = appState === 'listo';

  function handleEquipmentToggle(item: string, checked: boolean) {
    onEquipmentChange(checked ? [...equipment, item] : equipment.filter((entry) => entry !== item));
  }

  function handleLoadsToggle(hasLoads: boolean) {
    onAvailableLoadsKgChange(hasLoads ? [DEFAULT_LOAD_KG] : null);
  }

  function updateLoadAt(index: number, value: number) {
    if (!availableLoadsKg) return;
    onAvailableLoadsKgChange(availableLoadsKg.map((load, i) => (i === index ? value : load)));
  }

  function removeLoadAt(index: number) {
    if (!availableLoadsKg) return;
    onAvailableLoadsKgChange(availableLoadsKg.filter((_, i) => i !== index));
  }

  function addLoad() {
    onAvailableLoadsKgChange([...(availableLoadsKg ?? []), DEFAULT_LOAD_KG]);
  }

  async function handleCopy() {
    if (!card) return;
    const text = formatWodSummary(card, acceptedProposals);
    setCopyFallbackText(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Copiado al portapapeles.');
    } catch {
      setCopyMessage('No se pudo copiar automáticamente. Selecciona y copia el texto manualmente.');
      setCopyFallbackText(text);
    }
  }

  function handleSave() {
    const result = onSave();
    setSaveMessage(result.ok ? { ok: true, text: 'WOD guardado en este navegador.' } : { ok: false, text: result.message });
  }

  return (
    <Card as="section" className={styles.panel} aria-label="Adaptación y salida">
      <h2 className={styles.heading}>Adaptación y salida</h2>

      {storageNotice && <StatusMessage tone="warning">{storageNotice}</StatusMessage>}

      {restoreBanner && (
        <StatusMessage tone="info">
          <div className={styles.restoreRow}>
            <span>Se encontró un WOD guardado el {new Date(restoreBanner.savedAt).toLocaleString('es-ES')}.</span>
            <div className={styles.restoreActions}>
              <Button size="sm" onClick={onRestore}>
                Cargar
              </Button>
              <Button size="sm" variant="secondary" onClick={onClearSaved}>
                Descartar
              </Button>
            </div>
          </div>
        </StatusMessage>
      )}

      <fieldset className={styles.fieldset} disabled={adaptPhase === 'loading'}>
        <legend className={styles.legend}>Material disponible</legend>
        <div className={styles.equipmentGrid}>
          {EQUIPMENT_CATALOG.map((item) => (
            <label key={item} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={equipment.includes(item)}
                onChange={(event) => handleEquipmentToggle(item, event.target.checked)}
              />
              {item}
            </label>
          ))}
        </div>

        <div className={styles.toggle}>
          <label>
            <input type="radio" checked={availableLoadsKg === null} onChange={() => handleLoadsToggle(false)} /> Sin
            pesos declarados
          </label>
          <label>
            <input type="radio" checked={availableLoadsKg !== null} onChange={() => handleLoadsToggle(true)} /> Con
            pesos disponibles (kg)
          </label>
        </div>

        {availableLoadsKg !== null && (
          <div className={styles.rows}>
            {availableLoadsKg.map((load, index) => (
              <div className={styles.row} key={index}>
                <input
                  type="number"
                  min={0}
                  aria-label={`Peso disponible ${index + 1} (kg)`}
                  value={load}
                  onChange={(event) => updateLoadAt(index, Number(event.target.value))}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => removeLoadAt(index)}
                  disabled={availableLoadsKg.length <= 1}
                >
                  Eliminar
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addLoad}>
              Añadir peso
            </Button>
          </div>
        )}
      </fieldset>

      <p className={styles.hint}>Adaptar también envía la ficha y el material declarado a la IA.</p>

      <Button onClick={onAdapt} isLoading={adaptPhase === 'loading'} disabled={!canAdapt} fullWidth>
        Adaptar
      </Button>
      {!canAdapt && (
        <p className={styles.hint}>La adaptación estará disponible cuando la ficha esté revisada sin dudas pendientes.</p>
      )}
      {adaptPhase === 'error' && adaptErrorMessage && <StatusMessage tone="error">{adaptErrorMessage}</StatusMessage>}

      {proposals.length === 0 && adaptPhase === 'idle' && appState !== 'inicial' && card && (
        <p className={styles.hint}>Todavía no se ha pedido ninguna adaptación.</p>
      )}

      {proposals.length > 0 && (
        <ul className={styles.proposalsList}>
          {proposals.map((proposal) => {
            const key = proposalKey(proposal);
            const accepted = acceptedProposalKeys.has(key);
            return (
              <li key={key} className={styles.proposalItem}>
                <label className={styles.proposalLabel}>
                  <input type="checkbox" checked={accepted} onChange={() => onToggleProposalAccepted(proposal)} />
                  <div>
                    <strong>{proposal.substitute}</strong>
                    <div className={styles.tagRow}>
                      {proposal.requiredEquipment.map((item) => (
                        <Tag key={item} tone="accent">
                          {item}
                        </Tag>
                      ))}
                    </div>
                    <p className={styles.reason}>{proposal.reason}</p>
                    {proposal.caveats && <p className={styles.caveats}>{proposal.caveats}</p>}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.outputActions}>
        <Button variant="secondary" onClick={handleCopy} disabled={!hasCard}>
          Copiar
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={!hasCard}>
          Guardar en este navegador
        </Button>
        <Button variant="secondary" onClick={onClearSaved}>
          Borrar guardado
        </Button>
      </div>
      <p className={styles.hint}>El guardado es solo de este navegador: no sincroniza entre dispositivos.</p>

      {copyMessage && <StatusMessage tone={copyFallbackText ? 'warning' : 'success'}>{copyMessage}</StatusMessage>}
      {copyFallbackText && (
        <textarea className={styles.fallbackTextarea} readOnly value={copyFallbackText} aria-label="Texto para copiar manualmente" />
      )}
      {saveMessage && <StatusMessage tone={saveMessage.ok ? 'success' : 'error'}>{saveMessage.text}</StatusMessage>}
    </Card>
  );
}
