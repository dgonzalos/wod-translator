import type { Wod } from '@wod-translator/shared';
import { Input, Select } from '../ui';
import { parseOptionalNumber } from '../../utils/numberInput';
import styles from './WodMetaFields.module.css';

const FORMAT_OPTIONS = [
  { value: 'amrap', label: 'AMRAP' },
  { value: 'for_time', label: 'For Time' },
];

type MetaFieldPatch = Partial<Pick<Wod, 'format' | 'durationSeconds' | 'rounds' | 'timeCapSeconds'>>;

export interface WodMetaFieldsProps {
  card: Wod;
  disabled?: boolean;
  fieldErrors: Record<string, string>;
  onMetaFieldChange: (patch: MetaFieldPatch) => void;
}

export function WodMetaFields({ card, disabled = false, fieldErrors, onMetaFieldChange }: WodMetaFieldsProps) {
  return (
    <div className={styles.fields}>
      <Select
        label="Formato"
        value={card.format}
        onChange={(event) => onMetaFieldChange({ format: event.target.value as Wod['format'] })}
        options={FORMAT_OPTIONS}
        error={fieldErrors.format}
        disabled={disabled}
      />
      {card.format === 'amrap' ? (
        <Input
          label="Duración (segundos)"
          type="number"
          value={card.durationSeconds ?? ''}
          onChange={(event) => onMetaFieldChange({ durationSeconds: parseOptionalNumber(event.target.value) })}
          error={fieldErrors.durationSeconds}
          disabled={disabled}
        />
      ) : (
        <>
          <Input
            label="Rondas"
            type="number"
            value={card.rounds ?? ''}
            onChange={(event) => onMetaFieldChange({ rounds: parseOptionalNumber(event.target.value) })}
            error={fieldErrors.rounds}
            disabled={disabled}
          />
          <Input
            label="Time cap (segundos)"
            type="number"
            value={card.timeCapSeconds ?? ''}
            onChange={(event) => onMetaFieldChange({ timeCapSeconds: parseOptionalNumber(event.target.value) })}
            error={fieldErrors.timeCapSeconds}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
