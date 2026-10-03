import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { HTTP_STATUS } from './remoteApi';
import { useRemoteStore } from './remoteStore';

type RemoteSession = 'paired' | 'unpaired';

const SESSION_QUERY_KEY = ['remote', 'session'];

const fetchSession = async (): Promise<RemoteSession> => {
  const response = await fetch('/api/me');
  if (response.status === HTTP_STATUS.unauthorized) {
    return 'unpaired';
  }
  if (!response.ok) {
    throw new Error(`/api/me returned ${response.status}`);
  }
  return 'paired';
};

export const useRemoteSession = () => {
  const queryClient = useQueryClient();
  const {
    data: session,
    isError,
    refetch,
  } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    retry: false,
  });
  const connectionStatus = useRemoteStore((state) => state.connectionStatus);

  useEffect(() => {
    if (connectionStatus === 'failed') {
      refetch();
    }
  }, [connectionStatus, refetch]);

  const markPaired = () => {
    useRemoteStore.getState().setConnectionStatus('connecting');
    queryClient.setQueryData<RemoteSession>(SESSION_QUERY_KEY, 'paired');
  };

  return {
    session,
    isUnreachable: isError && session === undefined,
    markPaired,
  };
};
