import React, { useState, useEffect } from 'react';
import { getAutomationConfig, setAutomationStatus, setAutomationInterval, runAutomationOnce } from '../services/api';
import { Zap, Play, Clock, Save, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const AutomationControl: React.FC = () => {
  const { showToast } = useToast();
  const [active, setActive] = useState(false);
  const [interval, setIntervalVal] = useState(60);
  const [loading, setLoading] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [runResult, setRunResult] = useState<{sent: number, time: string} | null>(null);

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
        showToast({ type: 'success', message: 'Configurações salvas com sucesso.' });
    } catch (e) {
        setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
        showToast({ type: 'error', message: 'Algo deu errado. Tente novamente.' });
    } finally {
        setLoading(false);
    }
  };

  const handleRunNow = async () => {
    setRunningOnce(true);
    setRunResult(null);
    try {
        const result = await runAutomationOnce();
        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setRunResult({ sent: result.sent || 0, time });
    } catch (e: any) {
        alert("Erro ao disparar automação: " + (e.message || "Erro desconhecido"));
    } finally {
        setRunningOnce(false);
    }
  };

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Automação</h1>
          <p className="text-sm text-slate-400">
            Configure o comportamento automático de busca e envio de ofertas da Shopee.
          </p>
        </div>

        {/* Card: Automation Control */}
        <div className="app-card">
          {/* Title with Status Badge */}
          <div className="flex items-center gap-3 mb-6">
            <h2 className="app-card__title">Controle de Automação</h2>
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
            <button
              type="button"
              className={`toggle ${active ? "toggle--on" : "toggle--off"}`}
              onClick={() => setActive(!active)}
              aria-pressed={active}
              aria-label="Ativar ou desativar envio automático"
            >
              <span className="toggle__thumb" />
            </button>
          </div>

          {/* Interval Select */}
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between gap-4">
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
            <p className="field-helper">
              O bot buscará novas ofertas na Shopee e enviará aos grupos nesse intervalo.
            </p>
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
      <div className="app-card">
        <h2 className="app-card__title">Teste Manual</h2>
        <p className="text-sm text-slate-400 mb-6">
          Força uma busca e envio imediato via API Shopee, independente do intervalo configurado.
        </p>
        <button 
          onClick={handleRunNow}
          disabled={runningOnce}
          className="w-full btn-primary text-base py-4"
        >
          {runningOnce ? (
            <>
              <Loader2 className="animate-spin w-6 h-6" />
              Rodando...
            </>
          ) : (
            <>
              <Play className="w-6 h-6" />
              Rodar Agora (Buscar e Enviar)
            </>
          )}
        </button>
        {runResult && (
          <p className="run-feedback">
            Ofertas enviadas para {runResult.sent} {runResult.sent === 1 ? 'grupo' : 'grupos'} às {runResult.time}.
          </p>
        )}
      </div>
    </div>
    </main>
  );
};