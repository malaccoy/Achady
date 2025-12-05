import { useEffect, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectWhatsAppModal({ isOpen, onClose }: Props) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(false);

  // Iniciar sessão
  async function iniciarSessao() {
    setLoading(true);
    try {
      await fetch('/api/whatsapp/start', { method: "POST" });
      setStatus("starting");
    } catch (e) {
      console.error(e);
      alert("Erro ao comunicar com servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Polling a cada 2s
  useEffect(() => {
    if (!isOpen || status === "idle") return;

    // Se abriu e ainda não começou, inicia
    if (status === "idle") {
        iniciarSessao();
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/qr');
        
        if (res.ok) {
            const data = await res.json();
            
            // 1. Se já conectou
            if (data.status === "ready" || data.status === "connected") {
                setStatus("ready");
                setQrImage(null);
                clearInterval(interval);
                setTimeout(() => {
                    onClose();
                    // Opcional: recarregar para atualizar status na dashboard
                    window.location.reload();
                }, 1500);
            }
            // 2. Se tem QR (agora vem como imageUrl)
            else if (data.imageUrl) {
                setQrImage(data.imageUrl);
                setStatus("qr");
            }
            // 3. Se está iniciando ou aguardando
            else if (data.status) {
                setStatus(data.status);
            }
        }
      } catch (err) {
        console.error("Erro polling QR", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-[350px] text-center shadow-2xl">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Conectar WhatsApp</h2>

        {loading && <p className="text-slate-500">Conectando à VPS...</p>}

        {!loading && (status === "idle" || status === "offline") && (
           <button
             onClick={iniciarSessao}
             className="bg-achady-purple text-white px-4 py-2 rounded-lg hover:bg-achady-blue transition-colors"
           >
             Gerar QR Code
           </button>
        )}

        {status === "starting" && <p className="text-slate-500 animate-pulse">⏳ Aguardando QR Code da VPS...</p>}
        
        {status === "qr" && qrImage && (
          <div className="space-y-3">
            <div className="p-2 bg-white border border-slate-200 rounded-lg inline-block">
                <img src={qrImage} className="w-48 h-48 mx-auto" alt="WhatsApp QR Code" />
            </div>
            <p className="text-sm text-slate-600">Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar</p>
          </div>
        )}

        {status === "ready" && (
          <div className="py-4">
             <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                 <span className="text-2xl">✅</span>
             </div>
             <p className="text-green-600 font-bold">Conectado com sucesso!</p>
          </div>
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