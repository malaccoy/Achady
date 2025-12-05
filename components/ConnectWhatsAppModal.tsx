import { useEffect, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectWhatsAppModal({ isOpen, onClose }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(false);

  // Using proxied path /api/start/1 -> localhost:3000/start/1
  const userId = "1";

  // ✅ INICIAR SESSÃO
  async function iniciarSessao() {
    setLoading(true);
    try {
      await fetch(`/api/start/${userId}`, {
        method: "POST",
      });
      setStatus("starting");
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com servidor local.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ BUSCAR QR E STATUS A CADA 3 SEGUNDOS
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/qr/${userId}`);
        const data = await res.json();

        setStatus(data.status || "idle");
        setQr(data.qr || null);

        // ✅ SE CONECTOU → FECHA AUTOMATICAMENTE
        if (data.status === "ready" || data.status === "connected") {
          alert("✅ WhatsApp conectado com sucesso!");
          clearInterval(interval);
          onClose();
        }
      } catch (err) {
        console.error("Erro ao buscar status do WhatsApp", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[350px] text-center">
        <h2 className="text-lg font-bold mb-4">Conectar WhatsApp</h2>

        {loading && <p>Iniciando sessão...</p>}

        {!loading && (status === "idle" || status === "offline") && (
          <button
            onClick={iniciarSessao}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Iniciar Conexão
          </button>
        )}

        {status === "starting" && <p>⏳ Preparando QR Code...</p>}
        {status === "qr" && qr && (
          <>
            <img src={qr} className="mx-auto w-48 border-2 border-slate-200 rounded-lg p-2" />
            <p className="text-sm mt-2">Aguardando leitura...</p>
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
