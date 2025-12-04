
import React, { useEffect, useState } from 'react';
import { Card, Button } from '../components/UI';
import { RefreshCw, FileText, ArrowRight, Search, ExternalLink } from 'lucide-react';
import type { MessageLog } from '../types';
import { useNavigate } from 'react-router-dom';

export const Logs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/logs/list');
      const data = await res.json();
      
      if (data.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setError('Não foi possível carregar os logs do servidor.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Logs de Envio</h1>
          <p className="text-slate-500 mt-1">Monitoramento detalhado das ofertas enviadas aos grupos.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLogs} isLoading={loading}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar Tabela
        </Button>
      </div>

      <Card className="overflow-hidden" noPadding>
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Carregando registros...</div>
        ) : error ? (
           <div className="p-12 text-center text-red-500 bg-red-50">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-slate-500 font-medium">Nenhum envio registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Horário</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Grupo</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Preço / Desc.</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(log.enviadoEm).toLocaleDateString()} <br/>
                      <span className="text-xs text-slate-400">{new Date(log.enviadoEm).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                         {log.categoria}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {log.grupoNome}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 max-w-[200px] truncate" title={log.titulo}>
                      {log.titulo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(log.preco)}</div>
                      {log.descontoPercentual && (
                        <div className="text-xs text-emerald-600 font-medium">{log.descontoPercentual}% OFF</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                          Detalhes
                       </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Detalhes (Simplificado inline) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900">Detalhes do Envio</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                 ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Mensagem Enviada</label>
                <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm font-mono whitespace-pre-line border border-slate-200 max-h-60 overflow-y-auto">
                  {selectedLog.mensagemEnviada}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Preço Original</label>
                    <div className="text-sm text-slate-400 line-through">
                      {selectedLog.precoOriginal ? formatCurrency(selectedLog.precoOriginal) : '-'}
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Preço Oferta</label>
                    <div className="text-sm font-bold text-emerald-600">
                      {formatCurrency(selectedLog.preco)}
                    </div>
                 </div>
              </div>

              <div className="pt-2">
                 <a 
                   href={selectedLog.linkAfiliado} 
                   target="_blank" 
                   rel="noreferrer"
                   className="flex items-center justify-center gap-2 w-full py-2.5 bg-achady-purple text-white rounded-xl font-medium hover:bg-achady-blue transition-colors text-sm"
                 >
                    Ver na Shopee <ExternalLink className="w-4 h-4" />
                 </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
