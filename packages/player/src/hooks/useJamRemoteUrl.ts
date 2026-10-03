import { useCoreSetting } from './useCoreSetting';

const TRAILING_SLASHES = /\/+$/;

export const useJamRemoteUrl = () => {
  const [remoteUrl] = useCoreSetting<string>('integrations.jam.remoteUrl');
  const [publicUrl] = useCoreSetting<string>('integrations.jam.publicUrl');
  const preferredUrl = publicUrl?.trim() || remoteUrl || '';
  return preferredUrl.replace(TRAILING_SLASHES, '');
};
