import { QUANTITY_UNITS, type Load, type Movement, type QuantityUnit } from '@wod-translator/shared';
import { Card, Input, Select } from '../ui';
import { LoadsEditor } from './LoadsEditor';
import { parseOptionalNumber } from '../../utils/numberInput';
import styles from './MovementEditor.module.css';

const NO_UNIT_VALUE = '';
const QUANTITY_UNIT_OPTIONS = [
  { value: NO_UNIT_VALUE, label: '(sin unidad)' },
  ...QUANTITY_UNITS.map((unit) => ({ value: unit, label: unit })),
];

export interface MovementEditorProps {
  movement: Movement;
  index: number;
  disabled?: boolean;
  fieldErrors: Record<string, string>;
  onFieldChange: (movementId: string, patch: Partial<Pick<Movement, 'name' | 'quantity' | 'unit'>>) => void;
  onLoadsChange: (movementId: string, loads: Load[] | null) => void;
}

export function MovementEditor({
  movement,
  index,
  disabled = false,
  fieldErrors,
  onFieldChange,
  onLoadsChange,
}: MovementEditorProps) {
  const pathPrefix = `movements.${index}`;

  return (
    <Card as="li" className={styles.card}>
      <p className={styles.snippet}>“{movement.originalTextSnippet}”</p>
      <div className={styles.fields}>
        <Input
          label="Nombre"
          value={movement.name}
          onChange={(event) => onFieldChange(movement.id, { name: event.target.value })}
          error={fieldErrors[`${pathPrefix}.name`]}
          disabled={disabled}
        />
        <Input
          label="Cantidad"
          type="number"
          value={movement.quantity ?? ''}
          onChange={(event) => onFieldChange(movement.id, { quantity: parseOptionalNumber(event.target.value) })}
          error={fieldErrors[`${pathPrefix}.quantity`]}
          disabled={disabled}
        />
        <Select
          label="Unidad"
          value={movement.unit ?? NO_UNIT_VALUE}
          onChange={(event) =>
            onFieldChange(movement.id, {
              unit: event.target.value === NO_UNIT_VALUE ? null : (event.target.value as QuantityUnit),
            })
          }
          options={QUANTITY_UNIT_OPTIONS}
          error={fieldErrors[`${pathPrefix}.unit`]}
          disabled={disabled}
        />
      </div>
      <LoadsEditor
        loads={movement.loads}
        disabled={disabled}
        fieldErrors={fieldErrors}
        pathPrefix={`${pathPrefix}.loads`}
        onChange={(loads) => onLoadsChange(movement.id, loads)}
      />
    </Card>
  );
}
