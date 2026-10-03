import React from 'react';

import { registerServiceWorker } from './homeScreen';
import RemoteApp from './RemoteApp';

export const initRemoteApp = (
  root: ReturnType<typeof import('react-dom/client').createRoot>,
) => {
  registerServiceWorker();
  root.render(
    <React.StrictMode>
      <RemoteApp />
    </React.StrictMode>,
  );
};
