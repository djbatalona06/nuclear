import { DateTime } from 'luxon';
import { QRCodeSVG } from 'qrcode.react';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Button, SectionShell } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import type { RemoteDevice } from '../../services/tauri/bindings';
import { InfoField } from './InfoField';
import { useJamDevices } from './useJamDevices';

const SECONDS_PER_MINUTE = 60;
const QR_CODE_SIZE = 160;
const PAIRING_LINK_SEPARATOR = '/#pair=';

const formatCountdown = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const DeviceRow: FC<{
  device: RemoteDevice;
  onRevoke: (id: string) => void;
}> = ({ device, onRevoke }) => {
  const { t } = useTranslation('preferences');
  const lastSeen =
    device.lastSeenAt === null
      ? t('integrations.jam.devices.neverSeen')
      : t('integrations.jam.devices.lastSeen', {
          time: DateTime.fromSeconds(device.lastSeenAt).toRelative(),
        });

  return (
    <li
      className="border-border flex items-center justify-between gap-3 rounded-md border-(length:--border-width) px-3 py-2"
      data-testid="jam-device"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold" data-testid="jam-device-name">
          {device.name}
        </span>
        <span
          className="text-foreground-secondary text-sm"
          data-testid="jam-device-last-seen"
        >
          {lastSeen}
        </span>
      </div>
      <Button
        size="sm"
        intent="danger"
        onClick={() => onRevoke(device.id)}
        data-testid="jam-device-revoke"
      >
        {t('integrations.jam.devices.revoke')}
      </Button>
    </li>
  );
};

const JamDevicesPanel: FC = () => {
  const { t } = useTranslation('preferences');
  const [remoteUrl] = useCoreSetting<string>('integrations.jam.remoteUrl');
  const {
    devices,
    isLoaded,
    pairingCode,
    remainingSeconds,
    startPairing,
    isStartingPairing,
    revokeDevice,
  } = useJamDevices();

  const pairingLink = pairingCode
    ? `${remoteUrl ?? ''}${PAIRING_LINK_SEPARATOR}${pairingCode}`
    : '';

  return (
    <SectionShell
      title={t('integrations.jam.devices.title')}
      data-testid="jam-devices"
    >
      <div className="flex flex-col gap-4">
        <p className="text-foreground-secondary text-sm">
          {t('integrations.jam.devices.description')}
        </p>

        {pairingCode ? (
          <div
            className="border-border flex flex-col items-center gap-3 rounded-md border-(length:--border-width) p-4"
            data-testid="jam-pairing"
          >
            <QRCodeSVG
              value={pairingLink}
              size={QR_CODE_SIZE}
              marginSize={2}
              bgColor="#ffffff"
            />
            <span
              className="font-mono text-3xl tracking-widest"
              data-testid="jam-pairing-code"
            >
              {pairingCode}
            </span>
            <span
              className="text-foreground-secondary text-sm"
              data-testid="jam-pairing-countdown"
            >
              {t('integrations.jam.devices.expiresIn', {
                time: formatCountdown(remainingSeconds),
              })}
            </span>
            <InfoField
              label={t('integrations.jam.devices.pairingLink')}
              value={pairingLink}
            />
          </div>
        ) : (
          <Button
            className="self-start"
            onClick={startPairing}
            disabled={isStartingPairing}
            data-testid="jam-pair-new-device"
          >
            {t('integrations.jam.devices.pairNew')}
          </Button>
        )}

        {isLoaded && devices.length === 0 && (
          <p className="text-sm" data-testid="jam-devices-empty">
            {t('integrations.jam.devices.empty')}
          </p>
        )}
        {devices.length > 0 && (
          <ul className="flex flex-col gap-2">
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                onRevoke={revokeDevice}
              />
            ))}
          </ul>
        )}
      </div>
    </SectionShell>
  );
};

export const JamDevices: FC = () => {
  const [jamEnabled] = useCoreSetting<boolean>('integrations.jam.enabled');
  return jamEnabled ? <JamDevicesPanel /> : null;
};
