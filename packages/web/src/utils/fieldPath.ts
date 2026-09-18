import type { AdaptationProposal, Issue } from '@wod-translator/shared';

export function fieldErrorKey(path: (string | number)[]): string {
  return path.join('.');
}

// Indexed by position, not just field+message: two distinct issues can
// legitimately share identical text, and a collision would merge their
// resolved/unresolved state and their React list keys.
export function issueKey(issue: Pick<Issue, 'field' | 'message'>, index: number): string {
  return `${index}::${issue.field}::${issue.message}`;
}

export function proposalKey(proposal: Pick<AdaptationProposal, 'movementId' | 'substitute'>): string {
  return `${proposal.movementId}::${proposal.substitute}`;
}
