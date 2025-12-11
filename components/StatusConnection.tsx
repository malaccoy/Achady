import React, { useState, useEffect } from 'react';
import { getWhatsappStatus, getWhatsappQR, getSystemDiagnostics } from '../services/api';
import { RefreshCw, QrCode, ShieldCheck, WifiOff, Loader2, AlertTriangle, Smartphone, CheckCircle2, XCircle, Clock, MessageSquare, ShoppingBag, Zap, Info } from 'lucide-react';
import { SystemDiagnostics } from '../types';

export const StatusConnection: React.FC = () => {
  const [status, setStatus] = useState<string>("desconhecido");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

  useEffect(() => {
    // Load diagnostics on mount
    loadDiagnostics();
  }, []);

  async function loadDiagnostics() {
    try {
      const diag = await getSystemDiagnostics();
      setDiagnostics(diag);
      // Also update status from diagnostics
      if (diag.whatsappConnected) {
        setStatus('ready');
      }
    } catch (e) {
      console.error("Failed to load diagnostics:", e);
    }
  }

  async function handleCheckStatus() {
    try {
      setLoadingStatus(true);
      setError(null);
      const res = await getWhatsappStatus();
      setStatus(res.status);
      if (res.status !== "qr") {
        setQrDataUrl(null);
      }
      // Reload diagnostics after checking status
      await loadDiagnostics();
    } catch (e: any) {
      setError(e.message || "Não foi possível obter o status do WhatsApp.");
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
      await loadDiagnostics();
    } catch (e: any) {
      setError(e.message || "Erro ao gerar QR Code.");
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

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

        {/* System Status Checklist */}
        <div className="mb-6 bg-slate-900/30 border border-slate-700/50 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-500" />
            Status do Sistema
          </h3>
          <div className="grid gap-3">
            {/* WhatsApp Status */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md border border-slate-700/30">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics?.whatsappConnected ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-semibold text-green-400">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-semibold text-red-400">Desconectado</span>
                  </>
                )}
              </div>
            </div>

            {/* Shopee API Status */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md border border-slate-700/30">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">Shopee API</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics?.shopeeConfigured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-semibold text-green-400">Configurada</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-semibold text-yellow-400">Pendente</span>
                  </>
                )}
              </div>
            </div>

            {/* Automation Status */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md border border-slate-700/30">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">Automação</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics?.automationActive ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-semibold text-green-400">Ativa</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-400">Inativa</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Information */}
        {diagnostics && (
          <div className="mb-6 p-4 bg-slate-900/20 border border-slate-700/30 rounded-lg">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Informações de Diagnóstico
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 text-slate-400">
                <span className="text-slate-500">•</span>
                <span>
                  <strong className="text-slate-300">Última verificação de status:</strong>{' '}
                  {formatDateTime(diagnostics.lastStatusCheck)}
                </span>
              </div>
              {diagnostics.lastMessageSent ? (
                <div className="flex items-start gap-2 text-slate-400">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-300">Última mensagem enviada:</strong>{' '}
                    {formatDateTime(diagnostics.lastMessageSent.timestamp)} para{' '}
                    <span className="text-orange-400">{diagnostics.lastMessageSent.groupName}</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-slate-400">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-300">Última mensagem enviada:</strong> Nenhuma mensagem enviada ainda
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Setup Instructions */}
        <div className="mb-6 p-4 bg-blue-900/10 border border-blue-700/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-300 mb-2">Primeira conexão? Siga estes passos:</h4>
              <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>Clique em <strong className="text-slate-300">"Gerar QR Code"</strong> abaixo</li>
                <li>Abra o WhatsApp {'>'} <strong className="text-slate-300">Aparelhos conectados</strong> {'>'} <strong className="text-slate-300">Conectar com QR Code</strong></li>
                <li>Escaneie o código QR exibido e aguarde o status ficar em <strong className="text-green-400">verde</strong> como "Conectado"</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Old Status Indicator - kept for compatibility */}
        <div className={`p-4 rounded-md border flex items-center justify-between mb-6 transition-colors ${getStatusColor(status)}`}>
          <div className="flex items-center gap-3">
             {status === 'ready' ? <ShieldCheck className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
             <span className="font-semibold text-lg capitalize">
                Status WhatsApp: {getStatusLabel(status)}
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