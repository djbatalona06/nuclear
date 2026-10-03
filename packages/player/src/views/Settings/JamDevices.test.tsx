import { act, waitFor } from '@testing-library/react';

import { createJamDevicesWrapper } from './JamDevices.test-wrapper';

const commandMocks = await vi.hoisted(async () => {
  const { TauriCommandMocks } = await import('../../test/utils/commandMocks');
  return new TauriCommandMocks();
});

vi.mock('../../services/tauri/bindings', () => commandMocks.moduleFactory());

const Wrapper = createJamDevicesWrapper(commandMocks);

const NOW = Date.parse('2026-07-11T12:00:00Z');
const NOW_SECONDS = NOW / 1000;
const DEVICE_REFRESH_TIMEOUT_MS = 3000;

const kitchenIpad = {
  id: 'device-1',
  name: 'Kitchen iPad',
  createdAt: NOW_SECONDS - 86_400,
  lastSeenAt: NOW_SECONDS - 300,
};

const phone = {
  id: 'device-2',
  name: 'Phone',
  createdAt: NOW_SECONDS - 60,
  lastSeenAt: null,
};

describe('Nuclear Jam paired devices', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    Wrapper.init();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is hidden while Nuclear Jam is off', async () => {
    await Wrapper.mount({ jamEnabled: false });

    expect(Wrapper.panel).not.toBeInTheDocument();
  });

  it('shows an empty state when no devices are paired', async () => {
    await Wrapper.mount();

    expect(await Wrapper.findPanel()).toHaveTextContent(
      'No devices paired yet',
    );
    expect(Wrapper.emptyState).toBeInTheDocument();
  });

  it('lists paired devices with when they were last seen', async () => {
    Wrapper.mockDevices([phone, kitchenIpad]);

    await Wrapper.mount();

    await waitFor(() => {
      expect(Wrapper.devices).toEqual([
        { name: 'Phone', lastSeen: 'Not used yet' },
        { name: 'Kitchen iPad', lastSeen: 'Last seen 5 minutes ago' },
      ]);
    });
  });

  it('shows a pairing code and link for a new device', async () => {
    Wrapper.mockPairingCode('ABCD2345');
    await Wrapper.mount();
    await Wrapper.findPanel();

    await Wrapper.pairButton.click();

    await waitFor(() => {
      expect(Wrapper.pairing.code).toBe('ABCD2345');
    });
    expect(Wrapper.pairing.link).toBe(
      'https://desktop.tailnet.ts.net/#pair=ABCD2345',
    );
    expect(Wrapper.pairing.countdown).toBe('Expires in 5:00');
  });

  it('uses the Tailscale address for the pairing link when one is set', async () => {
    Wrapper.mockPairingCode('ABCD2345');
    await Wrapper.mount({
      remoteUrl: 'http://192.168.1.42:4120',
      publicUrl: 'https://desktop.tailnet.ts.net/',
    });
    await Wrapper.findPanel();

    await Wrapper.pairButton.click();

    await waitFor(() => {
      expect(Wrapper.pairing.link).toBe(
        'https://desktop.tailnet.ts.net/#pair=ABCD2345',
      );
    });
  });

  it('counts down and hides the code when it expires', async () => {
    Wrapper.mockPairingCode('ABCD2345');
    await Wrapper.mount();
    await Wrapper.findPanel();
    await Wrapper.pairButton.click();
    await waitFor(() => {
      expect(Wrapper.pairing.element).toBeInTheDocument();
    });

    act(() => {
      vi.setSystemTime(NOW + 61_000);
    });
    await waitFor(() => {
      expect(Wrapper.pairing.countdown).toBe('Expires in 3:59');
    });

    act(() => {
      vi.setSystemTime(NOW + 300_000);
    });
    await waitFor(() => {
      expect(Wrapper.pairing.element).not.toBeInTheDocument();
    });
  });

  it('hides the code once the new device has paired', async () => {
    Wrapper.mockPairingCode('ABCD2345');
    await Wrapper.mount();
    await Wrapper.findPanel();
    await Wrapper.pairButton.click();
    await waitFor(() => {
      expect(Wrapper.pairing.element).toBeInTheDocument();
    });

    Wrapper.mockDevices([phone]);

    await waitFor(
      () => {
        expect(Wrapper.pairing.element).not.toBeInTheDocument();
      },
      { timeout: DEVICE_REFRESH_TIMEOUT_MS },
    );
    expect(Wrapper.devices.map((device) => device.name)).toEqual(['Phone']);
  });

  it('revokes a device', async () => {
    Wrapper.mockDevices([phone, kitchenIpad]);
    await Wrapper.mount();
    await waitFor(() => {
      expect(Wrapper.devices).toHaveLength(2);
    });

    Wrapper.mockDevices([phone]);
    await Wrapper.revoke('Kitchen iPad');

    expect(Wrapper.revokeCommand).toHaveBeenCalledWith('device-1');
    await waitFor(() => {
      expect(Wrapper.devices.map((device) => device.name)).toEqual(['Phone']);
    });
  });
});
