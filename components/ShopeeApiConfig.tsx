import React, { useEffect, useState } from "react";
import { getShopeeConfig, saveShopeeConfig, testShopeeConnection } from "../services/api";
import { ShoppingBag, Save, Key, Lock, Loader2, CheckCircle2, Zap, AlertTriangle } from "lucide-react";

export const ShopeeApiConfig: React.FC = () => {
  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);
  const [masked, setMasked] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getShopeeConfig();
        if (cfg.hasCredentials) {
          setMasked(cfg.appIdMasked);
          setStatusMessage({ type: 'success', text: "Credenciais configuradas e salvas." });
        } else {
            setStatusMessage({ type: 'info', text: "Nenhuma credencial configurada." });
        }
      } catch (e) {
        setStatusMessage({ type: 'error', text: "Erro ao conectar com o servidor. Verifique se o backend está rodando." });
      }
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      await saveShopeeConfig(appId.trim(), secret.trim());
      setStatusMessage({ type: 'success', text: "Salvo com sucesso! Agora clique em TESTAR." });
      setMasked(appId.trim().slice(0, 3) + "****" + appId.trim().slice(-2));
      setAppId("");
      setSecret("");
    } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.response?.data?.error || err.message || "Erro ao salvar credenciais." });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatusMessage(null);
    try {
      const res = await testShopeeConnection();
      setStatusMessage({ 
        type: 'success', 
        text: `SUCESSO! Shopee API respondeu. Encontramos ${res.count} ofertas de teste.` 
      });
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ 
        type: 'error', 
        text: `FALHA: ${e.message || 'Verifique AppID/Secret e IP Whitelist.'}` 
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title and Description */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Config API Shopee</h1>
        <p className="text-sm text-slate-400">
          Configure suas credenciais da API de afiliados da Shopee para buscar ofertas automaticamente.
        </p>
      </div>

      {/* Card: Configuration */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-6">Configuração API Shopee</h2>
        
        {/* Instructions */}
        <div className="mb-6 space-y-2 text-sm text-slate-300">
          <p className="flex gap-3">
            <span className="font-bold text-orange-400">1.</span>
            <span>Acesse o <a href="https://console.affiliate.shopee.com.br" target="_blank" className="text-orange-400 underline hover:text-orange-300">Shopee Affiliate Console</a></span>
          </p>
          <p className="flex gap-3">
            <span className="font-bold text-orange-400">2.</span>
            <span>Copie seu <strong className="text-white">App ID</strong> e <strong className="text-white">Secret</strong></span>
          </p>
          <p className="flex gap-3">
            <span className="font-bold text-orange-400">3.</span>
            <span>Salve abaixo e clique em <strong className="text-white">Testar Conexão</strong></span>
          </p>
        </div>

        {/* Active Credentials Section */}
        {masked && (
          <div className="mb-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Credenciais Ativas</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500/10 p-2 rounded-full">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">Configuradas</div>
                  <div className="text-slate-300 text-sm font-mono mt-0.5">
                    AppID: {masked}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleTest}
                disabled={testing}
                className="text-sm btn-success"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
                Testar Conexão Agora
              </button>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-md text-sm border flex items-start gap-3 animate-in fade-in slide-in-from-top-2
            ${statusMessage.type === 'success' ? 'bg-green-900/20 text-green-200 border-green-900/30' : 
              statusMessage.type === 'error' ? 'bg-red-900/20 text-red-200 border-red-900/30' :
              'bg-blue-900/20 text-blue-200 border-blue-900/30'
            }`}>
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />}
            {statusMessage.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />}
            <span className="mt-0.5">{statusMessage.text}</span>
          </div>
        )}

        {/* Credentials Form */}
        <div className="border-t border-slate-700/50 pt-6 mt-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Credenciais configuradas e salvas</h3>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                <Key className="w-4 h-4" /> App ID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Ex: 18350640860"
                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white font-mono text-sm placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Secret Key
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Cole aqui a senha/secret da API"
                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white font-mono text-sm placeholder:text-slate-600"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Salvar Configuração
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};