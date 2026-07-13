import { describe, expect, it, vi } from 'vitest';

import { activateLatestAppVersion, type AppUpdateClient } from './settings-page';

function updateClient(options: { enabled: boolean; updateAvailable?: boolean }): AppUpdateClient & {
  checkForUpdate: ReturnType<typeof vi.fn>;
  activateUpdate: ReturnType<typeof vi.fn>;
} {
  return {
    isEnabled: options.enabled,
    checkForUpdate: vi.fn().mockResolvedValue(options.updateAvailable ?? false),
    activateUpdate: vi.fn().mockResolvedValue(true),
  };
}

describe('app update activation', () => {
  it('checks for and activates a new service-worker version', async () => {
    const update = updateClient({ enabled: true, updateAvailable: true });

    await activateLatestAppVersion(update);

    expect(update.checkForUpdate).toHaveBeenCalledOnce();
    expect(update.activateUpdate).toHaveBeenCalledOnce();
  });

  it('does not activate when the current version is already latest', async () => {
    const update = updateClient({ enabled: true, updateAvailable: false });

    await activateLatestAppVersion(update);

    expect(update.checkForUpdate).toHaveBeenCalledOnce();
    expect(update.activateUpdate).not.toHaveBeenCalled();
  });

  it('skips the service-worker check when updates are disabled', async () => {
    const update = updateClient({ enabled: false });

    await activateLatestAppVersion(update);

    expect(update.checkForUpdate).not.toHaveBeenCalled();
    expect(update.activateUpdate).not.toHaveBeenCalled();
  });
});
