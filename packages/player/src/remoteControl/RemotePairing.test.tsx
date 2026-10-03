import { waitFor } from '@testing-library/react';

import { RemoteControlWrapper } from './RemoteControl.test-wrapper';

vi.mock('@nuclearplayer/themes', () => ({
  setThemeId: vi.fn(),
  DEFAULT_THEME_ID: 'nuclear:default',
}));

const TOO_MANY_REQUESTS = 429;
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const SERVER_ERROR = 500;

describe('Remote pairing', () => {
  beforeEach(() => {
    RemoteControlWrapper.reset();
  });

  it('asks an unpaired device for a pairing code', async () => {
    await RemoteControlWrapper.mountUnpaired();

    expect(RemoteControlWrapper.pairing.form).toHaveTextContent(
      'Pair this device',
    );
    expect(RemoteControlWrapper.connectingState).not.toBeInTheDocument();
  });

  it('suggests a default device name', async () => {
    await RemoteControlWrapper.mountUnpaired();

    expect(RemoteControlWrapper.pairing.deviceNameInput.element).toHaveValue(
      'Phone',
    );
  });

  it('sends the code and device name to Nuclear', async () => {
    await RemoteControlWrapper.mountUnpaired();
    RemoteControlWrapper.pairing.mockSuccess();

    await RemoteControlWrapper.pairing.deviceNameInput.replace('Kitchen iPad');
    await RemoteControlWrapper.pairing.pairWith('ABCD2345');

    expect(global.fetch).toHaveBeenCalledWith('/api/pair', {
      method: 'POST',
      headers: {
        'X-Nuclear-Client': 'remote',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'ABCD2345', deviceName: 'Kitchen iPad' }),
    });
  });

  it('connects to Nuclear after pairing', async () => {
    await RemoteControlWrapper.mountUnpaired();
    RemoteControlWrapper.pairing.mockSuccess();

    await RemoteControlWrapper.pairing.pairWith('ABCD2345');

    await waitFor(() => {
      expect(RemoteControlWrapper.connectingState).toBeInTheDocument();
    });
    expect(RemoteControlWrapper.pairing.form).not.toBeInTheDocument();
  });

  it('prefills the code from a pairing link', async () => {
    RemoteControlWrapper.openPairingLink('ABCD2345');

    await RemoteControlWrapper.mountUnpaired();

    expect(RemoteControlWrapper.pairing.codeInput.element).toHaveValue(
      'ABCD2345',
    );
  });

  it.each([
    [UNAUTHORIZED, 'That code is wrong or has expired'],
    [TOO_MANY_REQUESTS, 'Too many wrong tries'],
    [BAD_REQUEST, 'Enter a name for this device'],
    [SERVER_ERROR, 'Pairing failed'],
  ])('explains a %i response from Nuclear', async (status, message) => {
    await RemoteControlWrapper.mountUnpaired();
    RemoteControlWrapper.pairing.mockFailure(status);

    await RemoteControlWrapper.pairing.pairWith('WRONG123');

    await waitFor(() => {
      expect(RemoteControlWrapper.pairing.error).toHaveTextContent(message);
    });
    expect(RemoteControlWrapper.pairing.form).toBeInTheDocument();
  });

  it('returns to pairing when this device is revoked', async () => {
    await RemoteControlWrapper.mount();
    await RemoteControlWrapper.simulateConnection();

    RemoteControlWrapper.revokeThisDevice();
    RemoteControlWrapper.simulateConnectionFailure();

    await waitFor(() => {
      expect(RemoteControlWrapper.pairing.form).toBeInTheDocument();
    });
  });

  it('shows the connection error when Nuclear cannot be reached', async () => {
    await RemoteControlWrapper.mount();
    await RemoteControlWrapper.simulateConnection();

    RemoteControlWrapper.simulateConnectionFailure();

    await waitFor(() => {
      expect(RemoteControlWrapper.errorState).toBeInTheDocument();
    });
    expect(RemoteControlWrapper.pairing.form).not.toBeInTheDocument();
  });
});
