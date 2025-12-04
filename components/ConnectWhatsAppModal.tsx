import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, Smartphone } from 'lucide-react';

interface ConnectWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onConnected: () => void;
}

const API_BASE = "https://achady-whatsapp-server.onrender.com";

export const ConnectWhatsAppModal: React.FC<ConnectWhatsAppModalProps> = ({ open, onClose, userId, onConnected }) => {
  const [status, setStatus] = useState<'loading' | 'qr' | 'authenticated'>('loading');
  const [qrImage, setQrImage] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: any;

    const iniciarSessao = async () => {
      try {
        await fetch(`${API_BASE}/generate-qr/${userId}`);
      } catch (err) {
        console.error("Erro ao iniciar sessão:", err);
      }
    };

    const buscarQR = () => {
      let tentativas = 0;
      intervalId = setInterval(async () => {
        try {
          tentativas++;
          if (tentativas > 60) { // Timeout após 2 minutos (60 * 2s)
            clearInterval(intervalId);
            return;
          }

          const resp = await fetch(`${API_BASE}/qr/${userId}`);
          const data = await resp.json();

          // Se tiver QR code novo
          if (data.status === 'qr' && data.qr) {
            setQrImage(data.qr);
            setStatus('qr');
          }

          // Se estiver conectado (ready ou authenticated)
          if (data.status === 'ready' || data.status === 'authenticated') {
            setStatus('authenticated');
            clearInterval(intervalId);
            onConnected(); // Notifica o pai que conectou
            setTimeout(() => {
              onClose();
            }, 1500);
          }

        } catch (err) {
          console.error("Erro buscando QR:", err);
        }
      }, 2000);
    };

    if (open && userId) {
      setStatus('loading');
      setQrImage(null);
      iniciarSessao();
      buscarQR();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [open, userId, onClose, onConnected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col items-center p-6">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 p-3 bg-slate-50 rounded-full text-achady-purple">
           <Smartphone className="w-6 h-6" />
        </div>
        
        <h2 className="text-xl font-display font-bold text-slate-900 mb-1">Conectar WhatsApp</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">Escaneie o QR Code com seu celular para vincular a conta.</p>

        <div className="flex flex-col items-center justify-center min-h-[280px] w-full">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-achady-purple animate-spin" />
              <p className="text-slate-500 font-medium animate-pulse">Gerando QR Code...</p>
            </div>
          )}

          {status === 'qr' && qrImage && (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm relative">
                <img src={qrImage} alt="QR Code WhatsApp" className="w-[240px] h-[240px]" />
                <div className="absolute inset-0 border-2 border-achady-purple/10 rounded-xl pointer-events-none"></div>
              </div>
              <p className="text-xs font-semibold text-achady-purple bg-brand-50 px-3 py-1 rounded-full animate-pulse">
                Aguardando leitura...
              </p>
            </div>
          )}

          {status === 'authenticated' && (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 py-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">WhatsApp Conectado!</h3>
                <p className="text-slate-500 text-sm">Sessão iniciada com sucesso.</p>
              </div>
            </div>
          )}
        </div>
        
        <button 
          onClick={onClose} 
          className="mt-4 text-sm text-slate-400 hover:text-slate-600 font-medium underline decoration-transparent hover:decoration-slate-300 transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};