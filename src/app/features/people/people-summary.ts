export interface PeopleSummaryMember {
  isOffline: boolean;
  isStale: boolean;
}

export function peopleSummaryLabel(people: ReadonlyArray<PeopleSummaryMember>): string {
  const activeCount = people.filter((person) => !person.isOffline && !person.isStale).length;
  return `${activeCount}/${people.length} active`;
}
