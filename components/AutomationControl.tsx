import React, { useState, useEffect } from 'react';
import { 
  getAutomationConfig, 
  setAutomationStatus, 
  setAutomationInterval, 
  setAutomationTimeWindow,
  setAutomationMaxOffers,
  setAutomationSmartMode,
  getAutomationStats,
  runAutomationOnce 
} from '../services/api';
import { Zap, Play, Clock, Save, Loader2, Calendar, TrendingUp, Users, Filter } from 'lucide-react';
import { AutomationStats } from '../types';

export const AutomationControl: React.FC = () => {
  const [active, setActive] = useState(false);
  const [interval, setIntervalVal] = useState(60);
  const [sendHourStart, setSendHourStart] = useState("08:00");
  const [sendHourEnd, setSendHourEnd] = useState("22:00");
  const [maxOffersPerDay, setMaxOffersPerDay] = useState(10);
  const [smartMode, setSmartMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [stats, setStats] = useState<AutomationStats>({ offersSentToday: 0, activeGroups: 0, offersIgnoredByBlacklist: 0 });

  useEffect(() => {
    const init = async () => {
        const config = await getAutomationConfig();
        setActive(config.active);
        setIntervalVal(config.intervalMinutes);
        setSendHourStart(config.sendHourStart);
        setSendHourEnd(config.sendHourEnd);
        setMaxOffersPerDay(config.maxOffersPerDay);
        setSmartMode(config.smartMode);
        
        // Load stats
        try {
          const statsData = await getAutomationStats();
          setStats(statsData);
        } catch (e) {
          console.error('Error loading stats:', e);
        }
    };
    init();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
        await setAutomationStatus(active);
        await setAutomationInterval(interval);
        await setAutomationTimeWindow(sendHourStart, sendHourEnd);
        await setAutomationMaxOffers(maxOffersPerDay);
        await setAutomationSmartMode(smartMode);
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
        // Reload stats after run
        try {
          const statsData = await getAutomationStats();
          setStats(statsData);
        } catch (e) {
          console.error('Error reloading stats:', e);
        }
    } catch (e) {
        alert("Erro ao disparar automação.");
    } finally {
        setRunningOnce(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Automation Summary Panel */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-orange-500" />
          Resumo da Automação
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Ofertas Enviadas Hoje</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">{stats.offersSentToday}</p>
              </div>
              <Zap className="w-8 h-8 text-orange-500/50" />
            </div>
          </div>
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Grupos Ativos</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{stats.activeGroups}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500/50" />
            </div>
          </div>
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Filtradas por Blacklist</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{stats.offersIgnoredByBlacklist}</p>
              </div>
              <Filter className="w-8 h-8 text-red-500/50" />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6 text-orange-500" />
          Controle de Automação
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
                
                {/* Switch Active */}
                <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
                    <div>
                        <h3 className="font-medium text-slate-200">Status da Automação</h3>
                        <p className="text-sm text-slate-500">Ativa ou desativa o envio automático</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                </div>

                {/* Interval Select */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Intervalo de Busca (Minutos)
                    </label>
                    <select 
                        value={interval}
                        onChange={(e) => setIntervalVal(Number(e.target.value))}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white"
                    >
                        <option value={5}>A cada 5 minutos</option>
                        <option value={15}>A cada 15 minutos</option>
                        <option value={30}>A cada 30 minutos</option>
                        <option value={60}>A cada 60 minutos</option>
                    </select>
                </div>

                {/* Time Window */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Janela de Horário
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Início</label>
                            <input 
                                type="time" 
                                value={sendHourStart}
                                onChange={(e) => setSendHourStart(e.target.value)}
                                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Fim</label>
                            <input 
                                type="time" 
                                value={sendHourEnd}
                                onChange={(e) => setSendHourEnd(e.target.value)}
                                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Mensagens serão enviadas apenas neste intervalo</p>
                </div>

                {/* Max Offers Per Day */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Máximo de Ofertas por Dia (por Grupo)
                    </label>
                    <input 
                        type="number" 
                        min="1" 
                        max="100"
                        value={maxOffersPerDay}
                        onChange={(e) => setMaxOffersPerDay(Number(e.target.value))}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Limite diário de mensagens por grupo</p>
                </div>

                {/* Smart Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">
                    <div>
                        <h3 className="font-medium text-slate-200">Modo Inteligente</h3>
                        <p className="text-sm text-slate-500">Evita ofertas muito parecidas em sequência</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={smartMode}
                            onChange={(e) => setSmartMode(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                </div>

                {message && (
                    <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-900/50' : 'bg-red-900/30 text-red-300 border border-red-900/50'}`}>
                        {message.text}
                    </div>
                )}

                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    Salvar Configurações
                </button>
            </div>

            <div className="flex flex-col gap-6">
                <div className="border-t border-slate-700/50 pt-6 mt-auto">
                    <h3 className="font-medium text-slate-200 mb-2">Teste Manual</h3>
                    <p className="text-sm text-slate-500 mb-4">Força uma busca e envio imediato via API Shopee, independente do intervalo.</p>
                    <button 
                        onClick={handleRunNow}
                        disabled={runningOnce}
                        className="w-full border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 py-3 rounded-md font-bold transition-colors flex items-center justify-center gap-2"
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