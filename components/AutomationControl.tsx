import React, { useState, useEffect } from 'react';
import { getAutomationConfig, setAutomationStatus, setAutomationInterval, runAutomationOnce } from '../services/api';
import { Zap, Play, Clock, Save, Loader2, Info } from 'lucide-react';

export const AutomationControl: React.FC = () => {
  const [active, setActive] = useState(false);
  const [interval, setIntervalVal] = useState(60);
  const [loading, setLoading] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const init = async () => {
        const config = await getAutomationConfig();
        setActive(config.active);
        setIntervalVal(config.intervalMinutes);
    };
    init();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
        await setAutomationStatus(active);
        await setAutomationInterval(interval);
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (e) {
        setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
        setLoading(false);
    }
  };

  const handleRunNow = async () => {
    setRunningOnce(true);
    try {
        await runAutomationOnce();
        alert("Automação disparada! Verifique os logs.");
    } catch (e) {
        alert("Erro ao disparar automação.");
    } finally {
        setRunningOnce(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          Controle de Automação
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
                
                {/* Switch Active */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                        <h3 className="font-medium text-slate-900">Status da Automação</h3>
                        <p className="text-sm text-slate-500">Ativa ou desativa o envio automático</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                {/* Interval Select */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Intervalo de Busca (Minutos)
                    </label>
                    <select 
                        value={interval}
                        onChange={(e) => setIntervalVal(Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value={5}>A cada 5 minutos</option>
                        <option value={15}>A cada 15 minutos</option>
                        <option value={30}>A cada 30 minutos</option>
                        <option value={60}>A cada 60 minutos</option>
                    </select>
                </div>

                {message && (
                    <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    Salvar Configurações
                </button>
            </div>

            <div className="flex flex-col gap-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4" />
                        Como funciona?
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        A automação busca ofertas da Shopee via scraping (usando Axios e HTML) diretamente na sua VPS. 
                        Se encontrar ofertas que batem com os critérios, ela envia automaticamente para todos os grupos ativos usando o modelo de mensagem configurado.
                    </p>
                </div>

                <div className="border-t border-slate-200 pt-6 mt-auto">
                    <h3 className="font-medium text-slate-900 mb-2">Teste Manual</h3>
                    <p className="text-sm text-slate-500 mb-4">Força uma busca e envio imediato, independente do intervalo.</p>
                    <button 
                        onClick={handleRunNow}
                        disabled={runningOnce}
                        className="w-full border-2 border-primary text-primary hover:bg-orange-50 py-3 rounded-md font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {runningOnce ? <Loader2 className="animate-spin w-5 h-5" /> : <Play className="w-5 h-5" />}
                        Rodar Agora (Buscar e Enviar)
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};