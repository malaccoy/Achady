import React, { useState, useEffect } from 'react';
import { getInstagramStatus, disconnectInstagram } from '../services/api';
import { InstagramStatus } from '../types';
import { Loader2, CheckCircle2, XCircle, Info, Clock, AlertTriangle, LogOut, Instagram, HelpCircle } from 'lucide-react';

export const InstagramConnection: React.FC = () => {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    
    // Check for OAuth callback success or error
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const reason = urlParams.get('reason');
    const username = urlParams.get('username');
    
    if (status === 'connected') {
      const displayUsername = username ? `@${username} ` : '';
      setSuccessMessage(`Instagram ${displayUsername}conectado com sucesso.`);
      // Reload status to get fresh data
      loadStatus();
    } else if (status === 'connected_limited') {
      const displayUsername = username ? `@${username} ` : '';
      setSuccessMessage(`Instagram ${displayUsername}conectado com recursos limitados. Algumas funcionalidades podem não estar disponíveis.`);
      // Reload status to get fresh data
      loadStatus();
    } else if (status === 'error') {
      // Map error reasons to user-friendly Portuguese messages (no Facebook Pages references)
      const errorMessages: Record<string, string> = {
        'no_instagram_business': 'Nenhuma conta Instagram Profissional encontrada. Verifique se sua conta é Business ou Creator.',
        'missing_permissions': 'Permissão de mensagens não concedida. Para automação de DM, aceite a permissão "instagram_manage_messages" durante a autorização.',
        'permissao_insuficiente': 'Permissão insuficiente para acessar os dados do Instagram. Verifique se sua conta é Profissional (Business ou Criador).',
        'invalid_token': 'Token inválido ou expirado. Por favor, tente conectar novamente.',
        'token_exchange_failed': 'Erro ao processar autorização. Por favor, tente novamente.',
        'invalid_state': 'Sessão expirada. Por favor, tente conectar novamente.',
        'server_config': 'Erro de configuração do servidor. Entre em contato com o suporte.',
        'no_code': 'Autorização não recebida. Por favor, tente novamente.',
        'rate_limit': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      };
      
      setError(errorMessages[reason || ''] || `Erro na conexão: ${reason || 'desconhecido'}`);
    }
    
    // Clean URL parameters
    if (status) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      setError(null);
      const res = await getInstagramStatus();
      setStatus(res);
      setLastCheckTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) {
      setError(e.message || 'Não foi possível obter o status do Instagram.');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      setError(null);
      setSuccessMessage(null);
      await disconnectInstagram();
      setStatus({ connected: false });
      setSuccessMessage('Instagram desconectado com sucesso.');
    } catch (e: any) {
      setError(e.message || 'Erro ao desconectar Instagram.');
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    // Navigate to OAuth start endpoint
    window.location.href = '/api/meta/auth/instagram';
  }

  const formatExpiryDate = (isoString?: string) => {
    if (!isoString) return null;
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
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Instagram — Conexão</h1>
          <p className="text-sm text-slate-400">
            Conecte sua conta Instagram Business para gerenciar comentários e mensagens através do Achady.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 bg-green-900/20 text-green-200 border-green-900/30">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            <span className="mt-0.5">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 bg-red-900/20 text-red-200 border-red-900/30">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <span className="mt-0.5">{error}</span>
          </div>
        )}

        {/* Card 1: Status do Instagram */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <Instagram className="w-5 h-5 text-orange-500" />
            Status da Conexão
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="ml-3 text-slate-400">Verificando status...</span>
            </div>
          ) : (
            <>
              {/* Status Badge */}
              <div className={`status-summary ${status?.connected ? (status?.limited ? 'status-summary--warning' : 'status-summary--ok') : 'status-summary--warning'}`}>
                <span className="status-summary__icon">
                  {status?.connected ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </span>
                <span className="status-summary__text">
                  Status: {status?.connected ? (status?.limited ? 'Conectado (limitado)' : 'Conectado') : 'Não conectado'}
                </span>
              </div>

              {/* Limited Connection Warning */}
              {status?.connected && status?.limited && (
                <div className="mt-4 p-3 rounded-md bg-yellow-900/20 border border-yellow-900/30 text-yellow-200 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Conexão com recursos limitados. Algumas funcionalidades podem não estar disponíveis.
                </div>
              )}

              {/* Connection Details */}
              {status?.connected && (
                <ul className="status-list mt-4">
                  {status.igUsername && (
                    <li className="status-row status-row--ok">
                      <span className="status-row__icon">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <span className="status-row__label">Usuário:</span>
                      <span className="status-row__value">@{status.igUsername}</span>
                    </li>
                  )}
                  {status.igBusinessId && (
                    <li className="status-row status-row--ok">
                      <span className="status-row__icon">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <span className="status-row__label">IG ID:</span>
                      <span className="status-row__value font-mono text-sm">{status.igBusinessId}</span>
                    </li>
                  )}
                  {status.expiresAt && (
                    <li className="status-row status-row--ok">
                      <span className="status-row__icon">
                        <Clock className="w-4 h-4" />
                      </span>
                      <span className="status-row__label">Token expira em:</span>
                      <span className="status-row__value">{formatExpiryDate(status.expiresAt)}</span>
                    </li>
                  )}
                </ul>
              )}

              {/* Action Button */}
              <div className="mt-6">
                {status?.connected ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="btn-secondary"
                  >
                    {disconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    {disconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="btn-primary"
                  >
                    <Instagram className="w-4 h-4" />
                    Conectar Instagram
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Card 2: Como Conectar - Help Section */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            Como conectar seu Instagram
          </h2>
          <div className="text-sm text-slate-300 space-y-4">
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Sua conta precisa ser <strong>Profissional</strong> (Business ou Criador).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Clique em "<strong>Conectar Instagram</strong>" e autorize as permissões solicitadas.</span>
              </li>
              <li className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <span>Se seus posts não aparecerem, verifique se o Instagram está em uma <strong>Conta Profissional</strong> e tente sincronizar novamente.</span>
              </li>
            </ul>
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-slate-400 text-xs">
                O Achady funciona com a ideia simples: <strong>alguém comentou no post → recebe uma DM automática</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Informações Adicionais */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <Info className="w-5 h-5 text-slate-400" />
            Informações
          </h2>
          <div className="text-sm text-slate-300 space-y-3">
            <p>
              Ao conectar, você autoriza o Achady a gerenciar comentários e mensagens conforme as permissões do app.
            </p>
            <p className="text-slate-400">
              A conexão é feita via Instagram Login e requer uma conta Instagram Profissional (Business ou Criador).
            </p>
          </div>
        </div>

        {/* Card 4: Diagnóstico */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Diagnóstico
          </h2>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">
              <strong>Última verificação:</strong>{' '}
              <span className="text-slate-400">
                {lastCheckTime || 'Nenhuma verificação realizada'}
              </span>
            </div>
            {error && (
              <div className="text-sm text-slate-300">
                <strong>Último erro:</strong>{' '}
                <span className="text-red-400">{error}</span>
              </div>
            )}
            <div className="pt-2">
              <button
                onClick={loadStatus}
                disabled={loading}
                className="btn-secondary text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                Verificar Novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
