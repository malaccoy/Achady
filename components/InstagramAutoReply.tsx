import React, { useState, useEffect } from 'react';
import { getInstagramAutoReply, saveInstagramAutoReply, getInstagramStatus } from '../services/api';
import { InstagramStatus } from '../types';
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Instagram,
  Info
} from 'lucide-react';

export const InstagramAutoReply: React.FC = () => {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [enabled, setEnabled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('Olá! Obrigado pelo seu comentário. 😊');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      // Load Instagram status
      const statusRes = await getInstagramStatus();
      setStatus(statusRes);
      
      // Load auto-reply settings
      const autoReply = await getInstagramAutoReply();
      setEnabled(autoReply.enabled);
      setMessageTemplate(autoReply.messageTemplate);
      setHasChanges(false);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      await saveInstagramAutoReply(enabled, messageTemplate);
      
      setSuccessMessage('Configurações salvas com sucesso!');
      setHasChanges(false);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  function handleToggle() {
    setEnabled(!enabled);
    setHasChanges(true);
  }

  function handleMessageChange(value: string) {
    setMessageTemplate(value);
    setHasChanges(true);
  }

  if (loading) {
    return (
      <main className="app-main">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-slate-400">Carregando...</span>
        </div>
      </main>
    );
  }

  if (!status?.connected) {
    return (
      <main className="app-main">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Resposta Automática</h1>
            <p className="text-sm text-slate-400">
              Configure a mensagem automática enviada quando alguém comentar no seu post.
            </p>
          </div>
          
          <div className="app-card">
            <div className="flex items-center gap-3 text-yellow-400">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-semibold">Instagram não conectado</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Conecte sua conta Instagram primeiro na página "Instagram" para configurar respostas automáticas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Resposta Automática</h1>
          <p className="text-sm text-slate-400">
            Quando alguém comentar no seu post, enviaremos automaticamente uma DM com a mensagem configurada.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 bg-green-900/20 text-green-200 border-green-900/30">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 bg-red-900/20 text-red-200 border-red-900/30">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Connected Account Info */}
        {status.igUsername && (
          <div className="app-card">
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-orange-500" />
              <span className="text-slate-300">Conta conectada:</span>
              <span className="font-medium text-slate-100">@{status.igUsername}</span>
            </div>
          </div>
        )}

        {/* Main Card - Toggle and Message */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            Configuração da Automação
          </h2>

          <div className="space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <h3 className="font-medium text-slate-200">Ativar automação</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Quando ativado, enviamos DM automaticamente para quem comentar nos seus posts.
                </p>
              </div>
              <button
                onClick={handleToggle}
                className={`relative p-1 rounded-full transition-colors ${
                  enabled ? 'bg-orange-500' : 'bg-slate-600'
                }`}
                aria-label={enabled ? 'Desativar automação' : 'Ativar automação'}
              >
                {enabled ? (
                  <ToggleRight className="w-8 h-8 text-white" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                )}
              </button>
            </div>

            {/* Message Template */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mensagem automática
              </label>
              <textarea
                value={messageTemplate}
                onChange={(e) => handleMessageChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                rows={4}
                placeholder="Digite a mensagem que será enviada automaticamente..."
                maxLength={1000}
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-slate-500">
                  Esta mensagem será enviada via DM (Private Reply) para quem comentar.
                </p>
                <span className="text-xs text-slate-500">
                  {messageTemplate.length}/1000
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                {hasChanges && (
                  <span className="text-yellow-400">Alterações não salvas</span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`btn-primary ${(!hasChanges && !saving) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            Como funciona
          </h2>
          <div className="text-sm text-slate-300 space-y-3">
            <p>
              <strong>1. Alguém comenta</strong> → Recebemos a notificação do Instagram
            </p>
            <p>
              <strong>2. Enviamos DM</strong> → A mensagem configurada é enviada via Private Reply
            </p>
            <p className="text-slate-400">
              A DM é enviada apenas uma vez por comentário. Comentários já processados são ignorados automaticamente.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};
