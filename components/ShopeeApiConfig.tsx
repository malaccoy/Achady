import React, { useEffect, useState } from "react";
import { getShopeeConfig, saveShopeeConfig } from "../services/api";
import { ShoppingBag, Save, Key, Lock, Loader2, CheckCircle2 } from "lucide-react";

export const ShopeeApiConfig: React.FC = () => {
  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);
  const [masked, setMasked] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getShopeeConfig();
        if (cfg.hasCredentials) {
          setMasked(cfg.appIdMasked);
          setStatusMessage({ type: 'success', text: "Credenciais já configuradas e ativas." });
        } else {
            setStatusMessage({ type: 'info', text: "Nenhuma credencial configurada. O sistema está usando scraping (Axios)." });
        }
      } catch (e) {
        setStatusMessage({ type: 'error', text: "Erro ao carregar configurações do servidor." });
      }
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      await saveShopeeConfig(appId.trim(), secret.trim());
      setStatusMessage({ type: 'success', text: "Salvo com sucesso! A automação já usará a API de afiliados." });
      setMasked(appId.trim().slice(0, 3) + "****" + appId.trim().slice(-2));
      setAppId("");
      setSecret("");
    } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.response?.data?.error || err.message || "Erro ao salvar credenciais." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
        <div className="card p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-orange-500" />
                Configuração API Shopee
            </h2>
            
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Configure o <strong>AppId</strong> e o <strong>Secret</strong> da sua conta de afiliado Shopee. 
                Quando configurado, o ACHADY usará a API oficial para buscar ofertas, o que é mais estável e rápido do que o scraping.
            </p>

            {masked && (
                <div className="mb-6 p-4 bg-green-900/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                        <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">Status Atual</div>
                        <div className="text-slate-300 text-sm">
                            Credenciais ativas para AppID: <code className="bg-black/30 px-2 py-0.5 rounded text-green-200 font-mono">{masked}</code>
                        </div>
                    </div>
                </div>
            )}

            {statusMessage && (
                <div className={`mb-6 p-3 rounded-md text-sm border flex items-center gap-2
                    ${statusMessage.type === 'success' ? 'bg-green-900/30 text-green-300 border-green-900/50' : 
                      statusMessage.type === 'error' ? 'bg-red-900/30 text-red-300 border-red-900/50' :
                      'bg-blue-900/20 text-blue-300 border-blue-900/40'
                    }`}>
                     {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                     {statusMessage.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-5 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                        <Key className="w-4 h-4" /> App ID
                    </label>
                    <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="Ex: 18350640860"
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white font-mono text-sm"
                        required
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
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white font-mono text-sm"
                        required
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-md font-medium transition-colors flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        Salvar Credenciais
                    </button>
                </div>
            </form>

            <p className="text-xs text-slate-500 mt-6 border-t border-slate-800 pt-4">
                As credenciais são armazenadas apenas na memória da sua VPS e usadas para assinar as requisições. 
                Por segurança, o Secret nunca é retornado pelo servidor.
            </p>
        </div>
    </div>
  );
};