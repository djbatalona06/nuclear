import { mockIPC } from '@tauri-apps/api/mocks';
import { waitFor } from '@testing-library/react';

import {
  getSetting,
  initializeSettingsStore,
  setSetting,
} from '../../stores/settingsStore';
import { registerBuiltInCoreSettings } from '../coreSettings';
import { initHttpApiHandler } from './httpApiHandler';

const PORT = 4120;
const LAN_ADDRESS = '192.168.1.42';
const JAM_ENABLED = 'core.integrations.jam.enabled';
const JAM_LOCAL_ONLY = 'core.integrations.jam.localOnly';
const JAM_API_URL = 'core.integrations.jam.apiUrl';

type CommandCall = { command: string; args: unknown };

describe('Nuclear Jam server lifecycle', () => {
  let calls: CommandCall[];
  let stopWatching: () => void;

  const commandsCalled = () =>
    calls
      .map((call) => call.command)
      .filter((command) => command.startsWith('http_api_'));

  beforeEach(async () => {
    calls = [];
    mockIPC((command, args) => {
      calls.push({ command, args });
      if (command === 'http_api_start') {
        const localOnly = (args as { localOnly: boolean }).localOnly;
        return { port: PORT, lan_address: localOnly ? null : LAN_ADDRESS };
      }
      return null;
    });
    await initializeSettingsStore();
    registerBuiltInCoreSettings();
    await setSetting(JAM_ENABLED, false);
    await setSetting(JAM_LOCAL_ONLY, false);
    stopWatching = await initHttpApiHandler();
  });

  afterEach(() => {
    stopWatching();
  });

  it('listens on the local network by default', async () => {
    await setSetting(JAM_ENABLED, true);

    await waitFor(() => {
      expect(getSetting(JAM_API_URL)).toBe(`http://${LAN_ADDRESS}:${PORT}/api`);
    });
    expect(calls).toContainEqual({
      command: 'http_api_start',
      args: { localOnly: false },
    });
  });

  it('listens only on this computer when tailnet only is on', async () => {
    await setSetting(JAM_LOCAL_ONLY, true);

    await setSetting(JAM_ENABLED, true);

    await waitFor(() => {
      expect(getSetting(JAM_API_URL)).toBe(`http://127.0.0.1:${PORT}/api`);
    });
    expect(calls).toContainEqual({
      command: 'http_api_start',
      args: { localOnly: true },
    });
  });

  it('restarts the server when tailnet only changes while it runs', async () => {
    await setSetting(JAM_ENABLED, true);
    await waitFor(() => {
      expect(commandsCalled()).toEqual(['http_api_start']);
    });

    await setSetting(JAM_LOCAL_ONLY, true);

    await waitFor(() => {
      expect(commandsCalled()).toEqual([
        'http_api_start',
        'http_api_stop',
        'http_api_start',
      ]);
    });
    const starts = calls.filter((call) => call.command === 'http_api_start');
    expect(starts.at(-1)?.args).toEqual({ localOnly: true });
  });

  it('leaves the server off when tailnet only changes while Jam is off', async () => {
    await setSetting(JAM_LOCAL_ONLY, true);

    expect(commandsCalled()).toEqual([]);
  });
});
