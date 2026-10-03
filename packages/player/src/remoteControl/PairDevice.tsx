import { useMutation } from '@tanstack/react-query';
import { FC, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { NuclearJam } from '@nuclearplayer/ui';

import { shouldSuggestHomeScreen } from './homeScreen';
import { HTTP_STATUS, JSON_HEADERS } from './remoteApi';

const PAIRING_LINK_PREFIX = '#pair=';

type PairRequest = {
  code: string;
  deviceName: string;
};

class PairingFailed extends Error {
  constructor(readonly status: number) {
    super(`Pairing failed with status ${status}`);
  }
}

const pairDevice = async (request: PairRequest) => {
  const response = await fetch('/api/pair', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new PairingFailed(response.status);
  }
};

const codeFromPairingLink = () => {
  const { hash } = window.location;
  return hash.startsWith(PAIRING_LINK_PREFIX)
    ? decodeURIComponent(hash.slice(PAIRING_LINK_PREFIX.length))
    : '';
};

const forgetPairingLink = () => {
  window.history.replaceState(null, '', window.location.pathname);
};

const errorKeyByStatus: Record<number, string> = {
  [HTTP_STATUS.unauthorized]: 'pair.errors.invalidCode',
  [HTTP_STATUS.tooManyRequests]: 'pair.errors.tooManyAttempts',
  [HTTP_STATUS.badRequest]: 'pair.errors.invalidDeviceName',
};

const errorKeyFor = (error: Error) =>
  (error instanceof PairingFailed && errorKeyByStatus[error.status]) ||
  'pair.errors.generic';

type PairDeviceProps = {
  onPaired: () => void;
};

export const PairDevice: FC<PairDeviceProps> = ({ onPaired }) => {
  const { t } = useTranslation('remote');
  const [code, setCode] = useState(codeFromPairingLink);
  const [deviceName, setDeviceName] = useState(() =>
    t('pair.defaultDeviceName'),
  );

  const pairing = useMutation({
    mutationFn: pairDevice,
    onSuccess: () => {
      forgetPairingLink();
      onPaired();
    },
  });

  return (
    <NuclearJam.Pair
      code={code}
      deviceName={deviceName}
      onCodeChange={setCode}
      onDeviceNameChange={setDeviceName}
      onSubmit={() => pairing.mutate({ code: code.trim(), deviceName })}
      isSubmitting={pairing.isPending}
      error={pairing.error ? t(errorKeyFor(pairing.error)) : undefined}
      hint={shouldSuggestHomeScreen() ? t('pair.homeScreenHint') : undefined}
      labels={{
        title: t('pair.title'),
        subtitle: t('pair.subtitle'),
        code: t('pair.code'),
        deviceName: t('pair.deviceName'),
        submit: t('pair.submit'),
      }}
    />
  );
};
