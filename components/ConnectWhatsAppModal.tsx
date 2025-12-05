import { useEffect, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectWhatsAppModal({ isOpen, onClose }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(false);

  // ✅ INICIAR SESSÃO (Mock/Check)
  async function iniciarSessao() {
    setLoading(true);
    try {
      // Chama api/whatsapp/start que é um mock para dar "kickstart" no fluxo da UI
      await fetch('/api/whatsapp/start', {
        method: "POST",
      });
      setStatus("starting");
    } catch (e) {
      console.error(e);
      alert("Erro ao comunicar com servidor.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ BUSCAR QR E STATUS A CADA 3 SEGUNDOS
  useEffect(() => {
    if (!isOpen || status === "idle") return;

    // Se acabou de abrir e não iniciou, tenta buscar QR direto para ver se já tem
    if (status === "idle") {
        iniciarSessao();
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/qr');
        
        if (res.status === 404) {
            // QR não gerado ainda ou já conectado (a API retorna 404 se não tiver QR)
            // Mantém status starting ou muda pra connected se tivéssemos certeza
            return;
        }

        const data = await res.json();
        
        // Se veio QR, mostra
        if (data.qr) {
            setQr(data.qr);
            setStatus("qr");
        } 
        // Se a API retornar algum status de sucesso (depende da implementação futura)
        else if (data.status === "ready") {
            setStatus("ready");
            clearInterval(interval);
            setTimeout(onClose, 2000);
        }

      } catch (err) {
        console.error("Erro polling QR", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[350px] text-center">
        <h2 className="text-lg font-bold mb-4">Conectar WhatsApp</h2>

        {loading && <p>Verificando servidor...</p>}

        {!loading && (status === "idle" || status === "offline") && (
           <button
             onClick={iniciarSessao}
             className="bg-blue-600 text-white px-4 py-2 rounded"
           >
             Iniciar Conexão
           </button>
        )}

        {status === "starting" && <p>⏳ Buscando QR Code na VPS...</p>}
        
        {status === "qr" && qr && (
          <>
            <img src={qr} className="mx-auto w-48 border-2 border-slate-200 rounded-lg p-2" alt="WhatsApp QR Code" />
            <p className="text-sm mt-2">Escaneie com seu WhatsApp</p>
          </>
        )}

        {status === "ready" && (
          <p className="text-green-600 font-bold">✅ Conectado!</p>
        )}

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 underline"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}