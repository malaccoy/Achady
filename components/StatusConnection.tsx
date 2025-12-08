import React, { useState, useEffect, useCallback } from 'react';
import { getBotStatus, generateQrCode } from '../services/api';
import { WhatsAppStatus } from '../types';
import { RefreshCw, QrCode, ShieldCheck, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

export const StatusConnection: React.FC = () => {
  const [statusData, setStatusData] = useState<WhatsAppStatus>({ status: 'DISCONNECTED' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBotStatus();
      setStatusData(prev => ({ ...prev, status: data.status }));
      if (data.status === 'QR_READY') {
          handleGenerateQR();
      }
    } catch (err) {
      setError("Falha ao conectar com o backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerateQR = async () => {
    try {
      const data = await generateQrCode();
      setStatusData(data);
    } catch (err) {
      setError("Erro ao gerar QR Code.");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
        getBotStatus().then(data => {
            setStatusData(prev => {
                if (prev.status !== data.status) {
                    return { ...prev, status: data.status };
                }
                return prev;
            });
        });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'CONNECTED': return 'bg-green-500/10 text-green-300 border-green-500/20';
      case 'CONNECTING': return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
      case 'QR_READY': return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      default: return 'bg-red-500/10 text-red-300 border-red-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-orange-500" />
          Status do Bot
        </h2>
        
        <div className={`p-4 rounded-md border flex items-center justify-between ${getStatusColor(statusData.status)}`}>
          <div className="flex items-center gap-3">
             {statusData.status === 'CONNECTED' ? <ShieldCheck /> : <WifiOff />}
             <span className="font-semibold text-lg">
                {statusData.status === 'CONNECTED' && 'Conectado'}
                {statusData.status === 'DISCONNECTED' && 'Desconectado'}
                {statusData.status === 'QR_READY' && 'Aguardando Leitura do QR'}
                {statusData.status === 'CONNECTING' && 'Conectando...'}
             </span>
          </div>
          <button 
            onClick={fetchStatus}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Verificar agora"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-900/30 text-red-200 text-sm rounded border border-red-900/50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
            </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-center p-8 bg-slate-900/30 border border-dashed border-slate-700/50 rounded-lg">
          {statusData.status === 'QR_READY' && statusData.qrCode ? (
            <div className="text-center">
              <img src={statusData.qrCode} alt="WhatsApp QR Code" className="w-64 h-64 mb-4 mx-auto border-4 border-white shadow-lg rounded-lg" />
              <p className="text-sm text-slate-400 font-medium">Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar aparelho</p>
            </div>
          ) : statusData.status === 'CONNECTED' ? (
            <div className="text-center py-10">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                    <ShieldCheck className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-200">Tudo pronto!</h3>
                <p className="text-slate-500">O bot está conectado e pronto para enviar ofertas.</p>
            </div>
          ) : (
            <div className="text-center">
               <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
               <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                 O bot precisa ler o QR Code para se conectar ao WhatsApp Web. Clique abaixo para gerar um novo código.
               </p>
               <button
                onClick={handleGenerateQR}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 mx-auto"
               >
                 {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <QrCode className="w-4 h-4"/>}
                 Gerar QR Code
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};