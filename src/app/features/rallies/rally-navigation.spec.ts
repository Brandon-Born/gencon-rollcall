import { describe, expect, it } from 'vitest';

import { isRallyCreationRequested, START_RALLY_QUERY_PARAMS } from './rally-navigation';

function queryParams(values: Record<string, string>): { get(name: string): string | null } {
  return {
    get: (name) => values[name] ?? null,
  };
}

describe('rally creation navigation', () => {
  it('uses a query parameter that opens the rally creation state', () => {
    expect(isRallyCreationRequested(queryParams(START_RALLY_QUERY_PARAMS))).toBe(true);
  });

  it('keeps ordinary map navigation out of rally creation state', () => {
    expect(isRallyCreationRequested(queryParams({}))).toBe(false);
  });
});
