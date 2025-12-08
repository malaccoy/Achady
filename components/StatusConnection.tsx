import React, { useState } from 'react';
import { getWhatsappStatus, getWhatsappQR } from '../services/api';
import { RefreshCw, QrCode, ShieldCheck, WifiOff, Loader2, AlertTriangle, Smartphone } from 'lucide-react';

export const StatusConnection: React.FC = () => {
  const [status, setStatus] = useState<string>("desconhecido");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckStatus() {
    try {
      setLoadingStatus(true);
      setError(null);
      const res = await getWhatsappStatus();
      setStatus(res.status);
      if (res.status !== "qr") {
        setQrDataUrl(null);
      }
    } catch (e) {
      setError("Não foi possível obter o status do WhatsApp.");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function handleGenerateQR() {
    try {
      setLoadingQR(true);
      setError(null);
      const res = await getWhatsappQR();
      setStatus(res.status);
      if (res.qr) {
        setQrDataUrl(res.qr);
      } else {
        setQrDataUrl(null);
      }
    } catch (e) {
      setError("Erro ao gerar QR Code.");
    } finally {
      setLoadingQR(false);
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'ready': return 'bg-green-500/10 text-green-300 border-green-500/20';
      case 'qr': return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'disconnected': return 'bg-red-500/10 text-red-300 border-red-500/20';
      case 'auth_failure': return 'bg-red-500/10 text-red-300 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
  };

  const getStatusLabel = (s: string) => {
      switch (s) {
          case 'ready': return 'Conectado';
          case 'qr': return 'Aguardando Leitura';
          case 'disconnected': return 'Desconectado';
          case 'auth_failure': return 'Falha na Autenticação';
          default: return s;
      }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-orange-500" />
          Status & Conexão WhatsApp
        </h2>
        
        <p className="text-sm text-slate-400 mb-6">
            Conecte o bot do ACHADY ao seu WhatsApp escaneando o QR Code. O processo é manual para garantir controle.
        </p>

        {/* Status Indicator */}
        <div className={`p-4 rounded-md border flex items-center justify-between mb-6 transition-colors ${getStatusColor(status)}`}>
          <div className="flex items-center gap-3">
             {status === 'ready' ? <ShieldCheck className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
             <span className="font-semibold text-lg capitalize">
                Status atual: {getStatusLabel(status)}
             </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button 
                onClick={handleCheckStatus} 
                disabled={loadingStatus}
                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
            >
                {loadingStatus ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                Verificar Status
            </button>
            
            <button 
                onClick={handleGenerateQR} 
                disabled={loadingQR}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
            >
                {loadingQR ? <Loader2 className="animate-spin w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                Gerar QR Code
            </button>
        </div>

        {error && (
            <div className="mb-6 p-3 bg-red-900/30 text-red-200 text-sm rounded border border-red-900/50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
            </div>
        )}

        {/* QR Code Display Area */}
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900/30 border border-dashed border-slate-700/50 rounded-lg min-h-[200px]">
            {qrDataUrl ? (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-white p-2 rounded-lg inline-block mb-4 shadow-xl">
                         <img src={qrDataUrl} alt="QR Code WhatsApp" className="w-64 h-64" />
                    </div>
                    <div className="text-slate-300 flex items-center justify-center gap-2 text-sm">
                        <Smartphone className="w-4 h-4" />
                        <p>Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar</p>
                    </div>
                </div>
            ) : status === 'qr' ? (
                <div className="text-center text-slate-500">
                    <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Clique em <strong>Gerar QR Code</strong> para exibir o código.</p>
                </div>
            ) : status === 'ready' ? (
                 <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                        <ShieldCheck className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-slate-400 font-medium">Bot conectado e operando.</p>
                </div>
            ) : (
                <div className="text-center text-slate-500">
                    <p className="text-sm">Aguardando ação...</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};