import type { Load, Movement } from '@wod-translator/shared';
import { MovementEditor } from './MovementEditor';
import styles from './MovementList.module.css';

export interface MovementListProps {
  movements: Movement[];
  disabled?: boolean;
  fieldErrors: Record<string, string>;
  onFieldChange: (movementId: string, patch: Partial<Pick<Movement, 'name' | 'quantity' | 'unit'>>) => void;
  onLoadsChange: (movementId: string, loads: Load[] | null) => void;
}

export function MovementList({ movements, disabled, fieldErrors, onFieldChange, onLoadsChange }: MovementListProps) {
  return (
    <ul className={styles.list}>
      {movements.map((movement, index) => (
        <MovementEditor
          key={movement.id}
          movement={movement}
          index={index}
          disabled={disabled}
          fieldErrors={fieldErrors}
          onFieldChange={onFieldChange}
          onLoadsChange={onLoadsChange}
        />
      ))}
    </ul>
  );
}
