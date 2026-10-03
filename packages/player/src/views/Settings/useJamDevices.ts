import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { RemoteDevice } from '../../services/tauri/bindings';
import { commands } from '../../services/tauri/bindings';
import { unwrapResult } from '../../services/tauri/results';

const DEVICES_QUERY_KEY = ['remote-devices'];
const MS_PER_SECOND = 1000;
const PAIRING_REFRESH_INTERVAL_MS = MS_PER_SECOND;

type ActivePairing = {
  code: string;
  expiresAt: number;
  devicesAtStart: number;
};

const isWaitingForDevice = (
  pairing: ActivePairing | null,
  now: number,
  deviceCount: number,
): pairing is ActivePairing =>
  pairing !== null &&
  now < pairing.expiresAt &&
  deviceCount <= pairing.devicesAtStart;

export const useJamDevices = () => {
  const queryClient = useQueryClient();
  const [pairing, setPairing] = useState<ActivePairing | null>(null);
  const [now, setNow] = useState(Date.now);

  const devicesQuery = useQuery<RemoteDevice[]>({
    queryKey: DEVICES_QUERY_KEY,
    queryFn: async () => unwrapResult(await commands.remoteDevicesList()),
    refetchInterval: (query) =>
      isWaitingForDevice(pairing, Date.now(), query.state.data?.length ?? 0)
        ? PAIRING_REFRESH_INTERVAL_MS
        : false,
  });
  const devices = devicesQuery.data ?? [];

  const startPairing = useMutation({
    mutationFn: async () => unwrapResult(await commands.remotePairingStart()),
    onSuccess: (result) => {
      const startedAt = Date.now();
      setNow(startedAt);
      setPairing({
        code: result.code,
        expiresAt: startedAt + result.expiresInSeconds * MS_PER_SECOND,
        devicesAtStart: devices.length,
      });
    },
  });

  const revokeDevice = useMutation({
    mutationFn: async (id: string) =>
      unwrapResult(await commands.remoteDeviceRevoke(id)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
  });

  const activePairing = isWaitingForDevice(pairing, now, devices.length)
    ? pairing
    : null;

  useEffect(() => {
    if (!activePairing) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [activePairing]);

  return {
    devices,
    isLoaded: devicesQuery.isSuccess,
    pairingCode: activePairing?.code ?? null,
    remainingSeconds: activePairing
      ? Math.ceil((activePairing.expiresAt - now) / MS_PER_SECOND)
      : 0,
    startPairing: () => startPairing.mutate(),
    isStartingPairing: startPairing.isPending,
    revokeDevice: (id: string) => revokeDevice.mutate(id),
  };
};
