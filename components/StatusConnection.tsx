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
      // Update status based on diagnostics
      if (diag.whatsappConnected) {
        setStatus('ready');
      } else {
        setStatus('disconnected');
      }
    } catch (e) {
      console.error("Failed to load diagnostics:", e);
      // Set a default diagnostics state to provide visual feedback
      setDiagnostics({
        whatsappConnected: false,
        shopeeConfigured: false,
        automationActive: false,
        lastMessageSent: null,
        lastStatusCheck: new Date().toISOString()
      });
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
      {/* Page Title and Description */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Status & Conexão</h1>
        <p className="text-sm text-slate-400">
          Conecte o bot do ACHADY ao seu WhatsApp escaneando o QR Code. O processo é manual para garantir controle.
        </p>
      </div>

      {/* Card 1: System Status */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-orange-500" />
          Status do Sistema
        </h2>
        <div className="space-y-3">
          {/* WhatsApp Status */}
          <div className="flex items-center gap-3">
            {diagnostics?.whatsappConnected ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm text-slate-300">
              <strong>WhatsApp:</strong> {diagnostics?.whatsappConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {/* Shopee API Status */}
          <div className="flex items-center gap-3">
            {diagnostics?.shopeeConfigured ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm text-slate-300">
              <strong>Shopee API:</strong> {diagnostics?.shopeeConfigured ? 'Configurada' : 'Não configurada'}
            </span>
          </div>

          {/* Automation Status */}
          <div className="flex items-center gap-3">
            {diagnostics?.automationActive ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm text-slate-300">
              <strong>Automação:</strong> {diagnostics?.automationActive ? 'Ativa' : 'Desativada'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Diagnostic Information */}
      {diagnostics && (
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-500" />
            Informações de Diagnóstico
          </h2>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">
              <strong>Última verificação de status:</strong>{' '}
              <span className="text-slate-400">{formatDateTime(diagnostics.lastStatusCheck)}</span>
            </div>
            {diagnostics.lastMessageSent ? (
              <div className="text-sm text-slate-300">
                <strong>Última mensagem enviada:</strong>{' '}
                <span className="text-slate-400">
                  {formatDateTime(diagnostics.lastMessageSent.timestamp)} para{' '}
                  <span className="text-orange-400">{diagnostics.lastMessageSent.groupName}</span>
                </span>
              </div>
            ) : (
              <div className="text-sm text-slate-300">
                <strong>Última mensagem enviada:</strong>{' '}
                <span className="text-slate-400">Nenhuma mensagem enviada ainda</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card 3: Setup Instructions */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-400" />
          Primeira conexão? Siga estes passos
        </h2>
        <ol className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-3">
            <span className="font-bold text-orange-400">1.</span>
            <span>Clique em <strong className="text-white">"Gerar QR Code"</strong> abaixo</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-orange-400">2.</span>
            <span>Abra o WhatsApp {'>'} <strong className="text-white">Aparelhos conectados</strong> {'>'} <strong className="text-white">Conectar com QR Code</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-orange-400">3.</span>
            <span>Escaneie o código QR exibido e aguarde o status ficar em <strong className="text-green-400">verde</strong> como "Conectado"</span>
          </li>
        </ol>
      </div>

      {/* Card 4: Actions and QR Code */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Ações e QR Code</h2>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button 
            onClick={handleCheckStatus} 
            disabled={loadingStatus}
            className="flex-1 btn-secondary"
          >
            {loadingStatus ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            Verificar Status
          </button>
          
          <button 
            onClick={handleGenerateQR} 
            disabled={loadingQR}
            className="flex-1 btn-primary"
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