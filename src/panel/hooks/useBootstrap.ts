import { useEffect } from 'react';
import { usePanelStore } from '../store';
import { sendToBg } from './useMessaging';
import type { BootstrapResponse } from '@/shared/types';

export function useBootstrap(): void {
  useEffect(() => {
    sendToBg<{ ok: boolean; payload?: BootstrapResponse }>({ kind: 'panel.bootstrap' })
      .then((res) => {
        if (res.ok && res.payload) usePanelStore.getState().onBootstrap(res.payload);
      })
      .catch(() => {});
  }, []);
}
