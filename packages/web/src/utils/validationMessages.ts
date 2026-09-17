import type { ZodIssue } from 'zod';

/**
 * Maps a Zod validation issue to user-facing Spanish copy. The *rule* (min/max
 * length, etc.) lives only in packages/shared's schemas — this only supplies
 * the wording, so the UI never re-implements the contract's constraints.
 */
export function describeIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string' && issue.minimum === 1) {
        return 'El texto no puede estar vacío.';
      }
      return `El valor es demasiado pequeño (mínimo ${issue.minimum}).`;
    case 'too_big':
      if (issue.origin === 'string') {
        return `El texto no puede superar los ${issue.maximum} caracteres.`;
      }
      return `El valor es demasiado grande (máximo ${issue.maximum}).`;
    case 'invalid_type':
      return 'El valor no tiene el tipo esperado.';
    default:
      return issue.message;
  }
}

export function describeFirstIssue(issues: ZodIssue[]): string {
  const [first] = issues;
  return first ? describeIssue(first) : 'Entrada no válida.';
}
