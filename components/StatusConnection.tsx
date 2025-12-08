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
      
      // If status is QR_READY but we don't have the QR image yet, fetch it
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
        // Simple polling for status
        getBotStatus().then(data => {
            setStatusData(prev => {
                // Only update if status changed to avoid resetting QR code if it exists
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
      case 'CONNECTED': return 'bg-green-100 text-green-800 border-green-200';
      case 'CONNECTING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'QR_READY': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
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
            className="p-2 hover:bg-black/10 rounded-full transition-colors"
            title="Verificar agora"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
            </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
          {statusData.status === 'QR_READY' && statusData.qrCode ? (
            <div className="text-center">
              <img src={statusData.qrCode} alt="WhatsApp QR Code" className="w-64 h-64 mb-4 mx-auto border-4 border-white shadow-lg" />
              <p className="text-sm text-slate-500 font-medium">Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar aparelho</p>
            </div>
          ) : statusData.status === 'CONNECTED' ? (
            <div className="text-center py-10">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Tudo pronto!</h3>
                <p className="text-slate-500">O bot está conectado e pronto para enviar ofertas.</p>
            </div>
          ) : (
            <div className="text-center">
               <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
               <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                 O bot precisa ler o QR Code para se conectar ao WhatsApp Web. Clique abaixo para gerar um novo código.
               </p>
               <button
                onClick={handleGenerateQR}
                disabled={loading}
                className="bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 mx-auto"
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
