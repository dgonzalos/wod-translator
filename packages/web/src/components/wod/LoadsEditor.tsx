import { LOAD_UNITS, type Load, type LoadUnit } from '@wod-translator/shared';
import { Button, Input, Select } from '../ui';
import styles from './LoadsEditor.module.css';

const LOAD_UNIT_OPTIONS = LOAD_UNITS.map((unit) => ({ value: unit, label: unit }));
const MAX_LOADS = 6;

export interface LoadsEditorProps {
  loads: Load[] | null;
  disabled?: boolean;
  fieldErrors: Record<string, string>;
  pathPrefix: string;
  onChange: (loads: Load[] | null) => void;
}

export function LoadsEditor({ loads, disabled = false, fieldErrors, pathPrefix, onChange }: LoadsEditorProps) {
  const hasLoad = loads !== null;
  const arrayError = fieldErrors[pathPrefix];

  function handleToggle(nextHasLoad: boolean) {
    onChange(nextHasLoad ? [{ value: 1, unit: 'kg' }] : null);
  }

  function updateLoad(index: number, patch: Partial<Load>) {
    if (!loads) return;
    onChange(loads.map((load, i) => (i === index ? { ...load, ...patch } : load)));
  }

  function removeLoad(index: number) {
    if (!loads) return;
    onChange(loads.filter((_, i) => i !== index));
  }

  function addLoad() {
    if (!loads) return;
    onChange([...loads, { value: 1, unit: 'kg' }]);
  }

  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>Carga</legend>
      <div className={styles.toggle}>
        <label>
          <input type="radio" checked={!hasLoad} onChange={() => handleToggle(false)} disabled={disabled} /> Sin
          carga
        </label>
        <label>
          <input type="radio" checked={hasLoad} onChange={() => handleToggle(true)} disabled={disabled} /> Con carga
        </label>
      </div>

      {hasLoad && (
        <div className={styles.rows}>
          {loads.map((load, index) => {
            const rowPrefix = `${pathPrefix}.${index}`;
            return (
              <div className={styles.row} key={index}>
                <Input
                  type="number"
                  aria-label={`Valor de carga alternativa ${index + 1}`}
                  value={load.value}
                  min={0}
                  onChange={(event) => updateLoad(index, { value: Number(event.target.value) })}
                  error={fieldErrors[`${rowPrefix}.value`]}
                  disabled={disabled}
                />
                <Select
                  aria-label={`Unidad de carga alternativa ${index + 1}`}
                  value={load.unit}
                  onChange={(event) => updateLoad(index, { unit: event.target.value as LoadUnit })}
                  options={LOAD_UNIT_OPTIONS}
                  error={fieldErrors[`${rowPrefix}.unit`]}
                  disabled={disabled}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => removeLoad(index)}
                  disabled={disabled || loads.length <= 1}
                >
                  Eliminar
                </Button>
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={addLoad} disabled={disabled || loads.length >= MAX_LOADS}>
            Añadir alternativa
          </Button>
        </div>
      )}
      {arrayError && <span className={styles.errorText}>{arrayError}</span>}
    </fieldset>
  );
}
