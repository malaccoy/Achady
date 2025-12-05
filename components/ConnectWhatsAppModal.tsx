import { useEffect, useState } from "react";
import { useWhatsappStatus } from "../hooks/useWhatsappStatus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectWhatsAppModal({ isOpen, onClose }: Props) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  
  // Polling rápido (2s) enquanto modal está aberto
  const { status, loading } = useWhatsappStatus(isOpen ? 2000 : 60000);

  // Iniciar sessão
  async function iniciarSessao() {
    setIsStarting(true);
    try {
      await fetch('/api/whatsapp/start', { method: "POST" });
    } catch (e) {
      console.error(e);
      alert("Erro ao comunicar com servidor.");
    } finally {
      setIsStarting(false);
    }
  }

  // Buscar QR separado (o endpoint de status não retorna a imagem para não pesar)
  useEffect(() => {
    if (!isOpen) return;
    
    // Se desconectado, busca QR
    if (!status.connected) {
        const fetchQr = async () => {
            try {
                const res = await fetch('/api/whatsapp/qr');
                if (res.ok) {
                    const data = await res.json();
                    if (data.imageUrl) setQrImage(data.imageUrl);
                }
            } catch(e) { console.log(e); }
        };
        fetchQr();
        const interval = setInterval(fetchQr, 2000);
        return () => clearInterval(interval);
    }
  }, [isOpen, status.connected]);

  // Efeito para fechar modal automaticamente se conectar
  useEffect(() => {
      if (isOpen && status.connected) {
          // Pequeno delay para usuário ver o sucesso
          setTimeout(() => {
              onClose();
              // Opcional: toast de sucesso
          }, 1500);
      }
  }, [isOpen, status.connected, onClose]);

  // Se abriu e está idle/offline, tenta start automático
  useEffect(() => {
      if (isOpen && !status.connected && !qrImage && !loading) {
          iniciarSessao();
      }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-[350px] text-center shadow-2xl">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Conectar WhatsApp</h2>

        {status.connected ? (
             <div className="py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">✅</span>
                </div>
                <p className="text-green-600 font-bold">Conectado com sucesso!</p>
                <p className="text-xs text-slate-400 mt-2">Fechando janela...</p>
             </div>
        ) : (
            <>
                {isStarting && <p className="text-slate-500 mb-4 animate-pulse">Iniciando sessão na VPS...</p>}
                
                {qrImage ? (
                  <div className="space-y-3">
                    <div className="p-2 bg-white border border-slate-200 rounded-lg inline-block">
                        <img src={qrImage} className="w-48 h-48 mx-auto" alt="WhatsApp QR Code" />
                    </div>
                    <p className="text-sm text-slate-600">Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar</p>
                  </div>
                ) : (
                    !isStarting && <p className="text-slate-500 py-8">Carregando QR Code...</p>
                )}
            </>
        )}

        <button
          onClick={onClose}
          className="mt-6 text-sm text-slate-400 hover:text-slate-600 underline"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}