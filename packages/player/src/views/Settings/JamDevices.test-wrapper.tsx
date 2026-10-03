import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../App';
import { registerBuiltInCoreSettings } from '../../services/coreSettings';
import type { RemoteDevice } from '../../services/tauri/bindings';
import {
  initializeSettingsStore,
  setSetting,
} from '../../stores/settingsStore';
import type { TauriCommandMocks } from '../../test/utils/commandMocks';
import { ok } from '../../test/utils/commandMocks';

const user = userEvent.setup();

const DEFAULT_REMOTE_URL = 'https://desktop.tailnet.ts.net';
const DEFAULT_PAIRING_TTL_SECONDS = 300;

export const createJamDevicesWrapper = (commandMocks: TauriCommandMocks) => ({
  init() {
    commandMocks.reset();
    this.mockDevices([]);
    commandMocks.command('remoteDeviceRevoke').mockResolvedValue(ok(null));
  },

  mockDevices(devices: RemoteDevice[]) {
    commandMocks.command('remoteDevicesList').mockResolvedValue(ok(devices));
  },

  mockPairingCode(
    code: string,
    expiresInSeconds = DEFAULT_PAIRING_TTL_SECONDS,
  ) {
    commandMocks
      .command('remotePairingStart')
      .mockResolvedValue(ok({ code, expiresInSeconds }));
  },

  get revokeCommand() {
    return commandMocks.command('remoteDeviceRevoke');
  },

  async mount({
    jamEnabled = true,
    remoteUrl = DEFAULT_REMOTE_URL,
    publicUrl = '',
  }: { jamEnabled?: boolean; remoteUrl?: string; publicUrl?: string } = {}) {
    await initializeSettingsStore();
    registerBuiltInCoreSettings();
    await setSetting('core.integrations.jam.enabled', jamEnabled);
    await setSetting('core.integrations.jam.remoteUrl', remoteUrl);
    await setSetting('core.integrations.jam.publicUrl', publicUrl);
    const component = render(<App />);
    await user.click(
      await component.findByRole('button', { name: 'Preferences' }),
    );
    await user.click(await component.findByRole('button', { name: 'General' }));
    await screen.findByRole('heading', { name: 'General', level: 1 });
    return component;
  },

  get panel() {
    return screen.queryByTestId('jam-devices');
  },

  async findPanel() {
    return screen.findByTestId('jam-devices');
  },

  get emptyState() {
    return screen.queryByTestId('jam-devices-empty');
  },

  get devices() {
    return screen.queryAllByTestId('jam-device').map((row) => ({
      name: within(row).getByTestId('jam-device-name').textContent,
      lastSeen: within(row).getByTestId('jam-device-last-seen').textContent,
    }));
  },

  async revoke(name: string) {
    const row = screen
      .getAllByTestId('jam-device')
      .find((element) => element.textContent?.includes(name))!;
    await user.click(within(row).getByTestId('jam-device-revoke'));
  },

  pairButton: {
    get element() {
      return screen.getByTestId('jam-pair-new-device');
    },
    async click() {
      await user.click(this.element);
    },
  },

  pairing: {
    get element() {
      return screen.queryByTestId('jam-pairing');
    },
    get code() {
      return screen.getByTestId('jam-pairing-code').textContent;
    },
    get link() {
      return within(screen.getByTestId('jam-pairing')).getByTestId(
        'info-field-value',
      ).textContent;
    },
    get countdown() {
      return screen.getByTestId('jam-pairing-countdown').textContent;
    },
  },
});
