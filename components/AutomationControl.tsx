import React, { useState, useEffect } from 'react';
import { getAutomationConfig, setAutomationStatus, setAutomationInterval, runAutomationOnce } from '../services/api';
import { Zap, Play, Clock, Save, Loader2 } from 'lucide-react';

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
      {/* Page Title and Description */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Automação</h1>
        <p className="text-sm text-slate-400">
          Configure o comportamento automático de busca e envio de ofertas da Shopee.
        </p>
      </div>

      {/* Card: Automation Control */}
      <div className="card p-6">
        {/* Title with Status Badge */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-bold text-slate-100">Controle de Automação</h2>
          {active ? (
            <span className="badge-success">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Automação Ativa
            </span>
          ) : (
            <span className="badge-error">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Automação Desativada
            </span>
          )}
        </div>

        <div className="space-y-6">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <div>
              <h3 className="font-medium text-slate-200 mb-1">Controle de Envio</h3>
              <p className="text-sm text-slate-500">Ativa ou desativa o envio automático</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {/* Interval Select */}
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <label className="text-sm font-medium text-slate-300 whitespace-nowrap">
              Intervalo de Busca:
            </label>
            <select 
              value={interval}
              onChange={(e) => setIntervalVal(Number(e.target.value))}
              className="flex-1 max-w-xs p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white"
            >
              <option value={5}>A cada 5 minutos</option>
              <option value={15}>A cada 15 minutos</option>
              <option value={30}>A cada 30 minutos</option>
              <option value={60}>A cada 60 minutos</option>
            </select>
          </div>

          {message && (
            <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-900/50' : 'bg-red-900/30 text-red-300 border border-red-900/50'}`}>
              {message.text}
            </div>
          )}

          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full btn-secondary"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Card: Manual Test */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Teste Manual</h2>
        <p className="text-sm text-slate-400 mb-6">
          Força uma busca e envio imediato via API Shopee, independente do intervalo configurado.
        </p>
        <button 
          onClick={handleRunNow}
          disabled={runningOnce}
          className="w-full btn-primary text-base py-4"
        >
          {runningOnce ? <Loader2 className="animate-spin w-6 h-6" /> : <Play className="w-6 h-6" />}
          Rodar Agora (Buscar e Enviar)
        </button>
      </div>
    </div>
  );
};