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
        if (!res.ok) throw new Error("Falha ao buscar status");
        
        const data = await res.json();
        
        if (!cancelled) {
          setStatus(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao buscar status do WhatsApp:', err);
        if (!cancelled) {
             // Em caso de erro, assume desconectado mas mantém loading false
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