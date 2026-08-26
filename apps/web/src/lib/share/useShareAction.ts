/**
 * One hook for every Share button: fires the native share sheet (text, email,
 * drive — the OS decides) with clipboard as the universal fallback, and holds
 * a short-lived status the button can render ("Link copied").
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sharePayload, type SharePayload } from './codec';

export function useShareAction(): {
  share: (payload: SharePayload, title: string) => Promise<void>;
  status: 'idle' | 'working' | 'shared' | 'copied';
} {
  const [status, setStatus] = useState<'idle' | 'working' | 'shared' | 'copied'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const share = useCallback(async (payload: SharePayload, title: string) => {
    setStatus('working');
    try {
      const how = await sharePayload(payload, title);
      setStatus(how);
    } catch {
      setStatus('idle');
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2500);
  }, []);
  return { share, status };
}
