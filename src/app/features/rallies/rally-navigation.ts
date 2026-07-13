const createRallyQueryParam = 'createRally';

export const START_RALLY_QUERY_PARAMS = {
  [createRallyQueryParam]: 'true',
} as const;

export interface RallyQueryParams {
  get(name: string): string | null;
}

export function isRallyCreationRequested(queryParams: RallyQueryParams): boolean {
  return queryParams.get(createRallyQueryParam) === 'true';
}
