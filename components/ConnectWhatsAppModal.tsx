import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, Smartphone, AlertCircle, RefreshCw } from 'lucide-react';

interface ConnectWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onConnected: () => void;
}

// URL da VPS definida no snippet
const API_BASE = "http://72.60.228.212:3000"; 

export const ConnectWhatsAppModal: React.FC<ConnectWhatsAppModalProps> = ({ open, onClose, userId, onConnected }) => {
  // Estados mapeados do Google Studio: whatsappStatus, qrCode
  // whatsappStatus pode ser: 'idle' | 'loading' | 'qr' | 'error' | 'authenticated'
  const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'loading' | 'qr' | 'error' | 'authenticated'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  
  // Ref para evitar atualizações de estado se o componente desmontar
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    if (open) {
      // Ao abrir, chama a função global: iniciarSessao
      iniciarSessao();
    }

    return () => {
      isMounted.current = false;
    };
  }, [open]);

  // 🔹 Função 1: Iniciar Sessão (Baseado no snippet do Studio)
  async function iniciarSessao() {
    if (!isMounted.current) return;
    
    // State.set("whatsappStatus", "loading");
    setWhatsappStatus("loading");
    setQrCode(null);

    try {
      // POST na rota /start/:id
      const res = await fetch(`${API_BASE}/start/${userId}`, {
        method: "POST",
      });

      const data = await res.json();

      // if (data.ok === true) { carregarQRCode() }
      if (data.ok === true) {
        carregarQRCode();  
      } else {
        setWhatsappStatus("error");
      }
    } catch (e) {
      console.log("Erro ao iniciar sessão:", e);
      setWhatsappStatus("error");
    }
  }

  // 🔹 Função 2: Carregar QR Code (Baseado no snippet do Studio)
  async function carregarQRCode() {
    if (!isMounted.current) return;

    try {
      const res = await fetch(`${API_BASE}/qr/${userId}`);
      const data = await res.json();

      // Verifica se já conectou (status: ready)
      if (data.status === 'ready' || data.status === 'authenticated') {
        setWhatsappStatus('authenticated');
        onConnected();
        setTimeout(() => {
          if (isMounted.current) onClose();
        }, 2000);
        return; 
      }

      // Se o QR ainda não estiver pronto (null ou undefined)
      if (!data.qr) {
        // setTimeout(carregarQRCode, 1500);
        if (isMounted.current) setTimeout(carregarQRCode, 1500);
        return;
      }

      // QR pronto → armazenar no estado
      // State.set("qrCode", data.qr);
      setQrCode(data.qr);
      // State.set("whatsappStatus", "qr");
      setWhatsappStatus("qr");

      // Continua buscando para saber quando o usuário ler o QR (virar ready)
      if (isMounted.current) setTimeout(carregarQRCode, 1500);

    } catch (e) {
      console.log("Erro ao buscar QR:", e);
      // setTimeout(carregarQRCode, 1500);
      if (isMounted.current) setTimeout(carregarQRCode, 1500);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col items-center p-6">
        
        {/* Botão Fechar */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone Topo */}
        <div className="mb-4 p-3 bg-slate-50 rounded-full text-achady-purple">
           <Smartphone className="w-6 h-6" />
        </div>
        
        <h2 className="text-xl font-display font-bold text-slate-900 mb-1">Conectar WhatsApp</h2>

        {/* --- LÓGICA DE EXIBIÇÃO --- */}

        {/* Estado: Carregando (Iniciando sessão) */}
        {whatsappStatus === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8 min-h-[250px] justify-center">
            <Loader2 className="w-10 h-10 text-achady-purple animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">Gerando sessão...</p>
          </div>
        )}

        {/* Estado: QR Code Pronto (Show when = whatsappStatus === "qr") */}
        {whatsappStatus === 'qr' && qrCode && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 min-h-[250px]">
            <p className="text-sm text-slate-500 text-center">Escaneie o QR Code abaixo com seu celular.</p>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm relative">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-[240px] h-[240px]" />
              <div className="absolute inset-0 border-2 border-achady-purple/10 rounded-xl pointer-events-none"></div>
            </div>
            <p className="text-xs font-semibold text-achady-purple bg-brand-50 px-3 py-1 rounded-full animate-pulse">
              Aguardando leitura...
            </p>
          </div>
        )}

        {/* Estado: Conectado */}
        {whatsappStatus === 'authenticated' && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 py-8 min-h-[250px] justify-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Conectado!</h3>
              <p className="text-slate-500 text-sm">Seu WhatsApp está pronto para uso.</p>
            </div>
          </div>
        )}

        {/* Estado: Erro */}
        {whatsappStatus === 'error' && (
           <div className="flex flex-col items-center gap-4 py-8 min-h-[250px] justify-center text-center">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
               <AlertCircle className="w-8 h-8" />
             </div>
             <div>
               <p className="font-bold text-slate-800">Falha na conexão</p>
               <p className="text-sm text-slate-500 mt-1">Não foi possível iniciar a sessão na VPS.</p>
             </div>
             <button 
                onClick={iniciarSessao}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
             >
               <RefreshCw className="w-4 h-4" /> Tentar Novamente
             </button>
           </div>
        )}

        {whatsappStatus !== 'authenticated' && (
          <button 
            onClick={onClose} 
            className="mt-4 text-sm text-slate-400 hover:text-slate-600 font-medium underline decoration-transparent hover:decoration-slate-300 transition-all"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};