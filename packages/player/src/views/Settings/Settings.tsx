import { Fragment } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { ScrollableArea, ViewShell } from '@nuclearplayer/ui';

import { JamDevices } from './JamDevices';
import { SettingsSection } from './SettingsSection';
import { useSettingsGroups } from './useSettingsGroups';

export const Settings = () => {
  const { t } = useTranslation('preferences');
  const groups = useSettingsGroups();

  return (
    <ViewShell title={t('general.title')}>
      <div className="flex w-full flex-col items-center justify-center overflow-hidden">
        <ScrollableArea className="max-w-120 flex-1 overflow-hidden">
          <div className="px-2">
            {groups.map((group) => (
              <Fragment key={group.name}>
                <SettingsSection
                  title={t(`${group.name}.title`, group.name)}
                  settings={group.settings}
                />
                {group.name === 'integrations' && <JamDevices />}
              </Fragment>
            ))}
          </div>
        </ScrollableArea>
      </div>
    </ViewShell>
  );
};
