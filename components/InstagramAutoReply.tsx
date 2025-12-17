import React, { useState, useEffect } from 'react';
import { getInstagramStatus, getInstagramAutoReply, saveInstagramAutoReply } from '../services/api';
import { InstagramStatus, InstagramAutoReplyConfig } from '../types';
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  MessageCircle, 
  Instagram,
  Info
} from 'lucide-react';

export const InstagramAutoReply: React.FC = () => {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [config, setConfig] = useState<InstagramAutoReplyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [enabled, setEnabled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');

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
      
      if (statusRes.connected) {
        // Load auto-reply config
        const configRes = await getInstagramAutoReply();
        setConfig(configRes);
        setEnabled(configRes.enabled);
        setMessageTemplate(configRes.messageTemplate);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  // Instagram DM message limits
  const MAX_MESSAGE_LENGTH = 1000;

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      if (enabled && !messageTemplate.trim()) {
        setError('Por favor, insira uma mensagem automática.');
        setSaving(false);
        return;
      }
      
      if (enabled && messageTemplate.length > MAX_MESSAGE_LENGTH) {
        setError(`A mensagem é muito longa. Máximo de ${MAX_MESSAGE_LENGTH} caracteres.`);
        setSaving(false);
        return;
      }
      
      await saveInstagramAutoReply(enabled, messageTemplate);
      setSuccessMessage('Configuração salva com sucesso!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
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
        <div className="app-card">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">Instagram não conectado</h2>
              <p className="text-sm text-slate-400 mt-1">
                Conecte sua conta Instagram primeiro na página "Instagram — Conexão" para ativar a automação.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2 flex items-center gap-3">
            <Instagram className="w-7 h-7 text-orange-500" />
            Automação de Comentários do Instagram
          </h1>
          <p className="text-sm text-slate-400">
            Quando alguém comentar nos seus posts, o Achady envia automaticamente uma mensagem privada.
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

        {/* Connection Info */}
        {status.igUsername && (
          <div className="p-3 rounded-md bg-slate-800/50 border border-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-slate-300">
              Conectado como <strong className="text-slate-100">@{status.igUsername}</strong>
            </span>
            {status.limited && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/30 text-yellow-300 ml-2">
                Conexão limitada
              </span>
            )}
          </div>
        )}

        {/* Main Configuration Card */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            Configuração da Automação
          </h2>

          <div className="space-y-6">
            {/* Toggle: Ativar automação */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
                <div>
                  <span className="text-slate-200 font-medium">Ativar automação</span>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Envia DM automaticamente para quem comentar nos seus posts
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Textarea: Mensagem automática */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mensagem automática
              </label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Olá! Obrigado pelo seu comentário. 🙂"
                rows={4}
                maxLength={MAX_MESSAGE_LENGTH}
                className={`w-full px-4 py-3 bg-slate-900 border rounded-lg text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none ${
                  messageTemplate.length > MAX_MESSAGE_LENGTH ? 'border-red-500' : 'border-slate-700'
                }`}
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-slate-500">
                  <Info className="w-3 h-3 inline mr-1" />
                  Dica: você pode colocar um link (ex.: grupo do WhatsApp, formulário, ou link de produto).
                </p>
                <span className={`text-xs ${messageTemplate.length > MAX_MESSAGE_LENGTH ? 'text-red-400' : 'text-slate-500'}`}>
                  {messageTemplate.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
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
              Quando alguém comenta em qualquer post do seu Instagram, o Achady detecta automaticamente e envia a mensagem privada configurada acima.
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>A mensagem é enviada apenas uma vez por comentário (evita duplicatas)</li>
              <li>Funciona com todos os seus posts automaticamente</li>
              <li>A automação respeita as políticas da Meta/Instagram</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
};
