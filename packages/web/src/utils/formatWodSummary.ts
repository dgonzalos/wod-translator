import type { AdaptationProposal, Wod } from '@wod-translator/shared';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes}:${String(remainder).padStart(2, '0')} min`;
}

function formatHeader(card: Wod): string {
  if (card.format === 'amrap') {
    return card.durationSeconds === null ? 'AMRAP (duración sin especificar)' : `AMRAP ${formatDuration(card.durationSeconds)}`;
  }
  const parts = ['For Time'];
  if (card.rounds !== null) parts.push(`${card.rounds} rondas`);
  if (card.timeCapSeconds !== null) parts.push(`tope ${formatDuration(card.timeCapSeconds)}`);
  return parts.join(', ');
}

function formatMovementLine(movement: Wod['movements'][number]): string {
  const quantity = [movement.quantity, movement.unit].filter((part) => part !== null).join(' ');
  const loads = movement.loads ? movement.loads.map((load) => `${load.value}${load.unit}`).join('/') : null;
  const parts = [quantity, movement.name].filter((part) => part.length > 0);
  const line = parts.join(' ');
  return loads ? `- ${line} — ${loads}` : `- ${line}`;
}

// Plain-text summary for the "copy" action (spec §4 RF-08). Pure and DOM-free
// so it's unit-testable without a clipboard or a browser environment.
export function formatWodSummary(card: Wod, acceptedProposals: AdaptationProposal[]): string {
  const lines = [formatHeader(card), ...card.movements.map(formatMovementLine)];

  if (acceptedProposals.length > 0) {
    const movementNameById = new Map(card.movements.map((movement) => [movement.id, movement.name]));
    lines.push('', 'Sustituciones aceptadas:');
    for (const proposal of acceptedProposals) {
      const originalName = movementNameById.get(proposal.movementId) ?? proposal.movementId;
      lines.push(`- ${originalName} → ${proposal.substitute} (motivo: ${proposal.reason})`);
    }
  }

  return lines.join('\n');
}
