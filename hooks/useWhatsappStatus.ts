import { useEffect, useState } from 'react';

export type WhatsappStatus = {
  connected: boolean;
  shopeeConfigured: boolean;
  groupConfigured: boolean;
  automationEnabled?: boolean;
  connectionStatus?: string;
  error?: string;
};

export function useWhatsappStatus(pollIntervalMs: number = 5000) {
  const [status, setStatus] = useState<WhatsappStatus>({
    connected: false,
    shopeeConfigured: false,
    groupConfigured: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Usa fetch nativo para evitar dependência excessiva de axios no front se não necessário
        const res = await fetch('/api/whatsapp/status');
        
        // Handle server errors (e.g. 504, 500) gracefully without throwing
        if (!res.ok) {
            if (!cancelled) {
                setStatus(prev => ({ ...prev, connected: false }));
                setLoading(false);
            }
            return;
        }
        
        const data = await res.json();
        
        if (!cancelled) {
          setStatus(data);
          setLoading(false);
        }
      } catch (err) {
        // Suppress network errors (e.g. server offline) to avoid console noise
        if (!cancelled) {
             setStatus(prev => ({ ...prev, connected: false }));
             setLoading(false);
        }
      }
    }

    load(); // Call immediately
    const interval = setInterval(load, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return { status, loading };
}