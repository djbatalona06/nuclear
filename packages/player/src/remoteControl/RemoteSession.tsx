import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { NuclearJam } from '@nuclearplayer/ui';

import { PairDevice } from './PairDevice';
import RemoteControl from './RemoteControl';
import { useRemoteSession } from './useRemoteSession';

export const RemoteSession: FC = () => {
  const { t } = useTranslation('remote');
  const { session, isUnreachable, markPaired } = useRemoteSession();

  if (session === 'paired') {
    return <RemoteControl />;
  }

  return (
    <NuclearJam>
      {session === 'unpaired' && <PairDevice onPaired={markPaired} />}
      {isUnreachable && (
        <NuclearJam.Error
          labels={{ title: t('error.title'), subtitle: t('error.subtitle') }}
        />
      )}
      {session === undefined && !isUnreachable && (
        <NuclearJam.Connecting
          labels={{
            title: t('connecting.title'),
            subtitle: t('connecting.subtitle'),
          }}
        />
      )}
    </NuclearJam>
  );
};
