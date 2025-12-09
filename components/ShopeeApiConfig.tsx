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
        <div className="card p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-orange-500" />
                Configuração API Shopee
            </h2>
            
            <p className="text-sm text-slate-400 mb-6 leading-relaxed bg-slate-900/40 p-3 rounded border border-slate-700/50">
                1. Acesse o <a href="https://console.affiliate.shopee.com.br" target="_blank" className="text-orange-400 underline">Shopee Affiliate Console</a>.<br/>
                2. Copie seu <strong>App ID</strong> e <strong>Secret</strong>.<br/>
                3. Salve abaixo e clique em <strong>Testar Conexão</strong>.
            </p>

            {masked && (
                <div className="mb-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/10 p-2 rounded-full">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">Credenciais Ativas</div>
                            <div className="text-slate-300 text-sm font-mono mt-0.5">
                                AppID: {masked}
                            </div>
                        </div>
                    </div>
                    <button 
                      onClick={handleTest}
                      disabled={testing}
                      className="w-full md:w-auto text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
                      Testar Conexão Agora
                    </button>
                </div>
            )}

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

            <form onSubmit={handleSave} className="space-y-5 max-w-lg mt-4">
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

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full md:w-auto bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-md font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        Salvar Configuração
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};