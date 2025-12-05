import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, Smartphone, AlertCircle, RefreshCw } from 'lucide-react';

interface ConnectWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onConnected: () => void;
}

export const ConnectWhatsAppModal: React.FC<ConnectWhatsAppModalProps> = ({ open, onClose, userId, onConnected }) => {
  const [status, setStatus] = useState<'starting' | 'qr' | 'authenticated' | 'connected' | 'disconnected' | 'error'>('starting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');
  
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    if (open) {
      iniciarSessao();
    }
    return () => { isMounted.current = false; };
  }, [open]);

  // ✅ 1. INICIAR SESSÃO (Via Proxy Interno)
  async function iniciarSessao() {
    if (!isMounted.current) return;
    setStatus("starting");
    setQrCode(null);
    setErrorDetails('');

    try {
      // Chama o endpoint interno criado em /api/whatsapp/start
      const res = await fetch(`/api/whatsapp/start`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        throw new Error(`Erro API: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Inicia polling do QR
      buscarQRCode();
    } catch (e: any) {
      console.error("Erro ao iniciar:", e);
      setStatus("error");
      setErrorDetails(e.message || "Falha de conexão com o servidor.");
    }
  }

  // ✅ 2. BUSCAR QR (Via Proxy Interno)
  async function buscarQRCode() {
    if (!isMounted.current) return;

    try {
      // Chama o endpoint interno criado em /api/whatsapp/qr
      const res = await fetch(`/api/whatsapp/qr`);
      const data = await res.json();

      console.log("Status API:", data.status);

      if (data.status === 'connected') {
        setStatus('connected');
        onConnected();
        setTimeout(() => { if (isMounted.current) onClose(); }, 2000);
        return;
      }
      
      if (data.status === 'authenticated') {
        setStatus('authenticated');
        // Continua buscando até virar 'connected'
      } else if (data.status === 'qr' && data.qr) {
        setQrCode(data.qr);
        setStatus('qr');
      } else if (data.status === 'starting') {
        setStatus('starting');
      }

      // Polling a cada 3 segundos
      if (isMounted.current) {
        setTimeout(buscarQRCode, 3000);
      }

    } catch (e: any) {
      console.error("Erro polling:", e);
      if (status !== 'qr' && status !== 'authenticated') {
        setStatus("error");
        setErrorDetails("Tentando reconectar... " + (e.message || ""));
        if (isMounted.current) setTimeout(buscarQRCode, 3000);
      } else {
         if (isMounted.current) setTimeout(buscarQRCode, 3000);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col items-center p-6">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 p-3 bg-slate-50 rounded-full text-achady-purple">
           <Smartphone className="w-6 h-6" />
        </div>
        
        <h2 className="text-xl font-display font-bold text-slate-900 mb-1">Conectar WhatsApp</h2>

        {/* LOADING / STARTING */}
        {(status === 'starting' || (status === 'qr' && !qrCode)) && (
          <div className="flex flex-col items-center gap-4 py-8 min-h-[250px] justify-center">
            <Loader2 className="w-10 h-10 text-achady-purple animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">Iniciando servidor...</p>
          </div>
        )}

        {/* QR CODE */}
        {status === 'qr' && qrCode && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 min-h-[250px]">
            <p className="text-sm text-slate-500 text-center">Escaneie o QR Code abaixo:</p>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm relative">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-[240px] h-[240px]" />
            </div>
            <p className="text-xs font-semibold text-achady-purple bg-brand-50 px-3 py-1 rounded-full animate-pulse">
              Aguardando leitura...
            </p>
          </div>
        )}

        {/* AUTHENTICATED */}
        {status === 'authenticated' && (
          <div className="flex flex-col items-center gap-4 py-8 min-h-[250px] justify-center">
             <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
             <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Autenticado!</h3>
                <p className="text-slate-500 text-sm">Sincronizando chats, aguarde...</p>
             </div>
          </div>
        )}

        {/* CONNECTED */}
        {status === 'connected' && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 py-8 min-h-[250px] justify-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Online ✅</h3>
              <p className="text-slate-500 text-sm">Conexão estabelecida com sucesso.</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
           <div className="flex flex-col items-center gap-4 py-8 min-h-[250px] justify-center text-center">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
               <AlertCircle className="w-8 h-8" />
             </div>
             <div className="max-w-[280px]">
                <p className="font-bold text-slate-800 mb-2">Erro de Conexão</p>
                <p className="text-xs text-slate-500 mb-4 break-words leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                  {errorDetails || "O servidor não respondeu."}
                </p>
             </div>
             <button onClick={iniciarSessao} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors">
               <RefreshCw className="w-4 h-4" /> Tentar Novamente
             </button>
           </div>
        )}
      </div>
    </div>
  );
};