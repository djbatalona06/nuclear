import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC } from 'react';

import { RemoteSession } from './RemoteSession';

const defaultQueryClient = new QueryClient();

type RemoteAppProps = {
  queryClientProp?: QueryClient;
};

const RemoteApp: FC<RemoteAppProps> = ({ queryClientProp }) => (
  <QueryClientProvider client={queryClientProp ?? defaultQueryClient}>
    <RemoteSession />
  </QueryClientProvider>
);

export default RemoteApp;
