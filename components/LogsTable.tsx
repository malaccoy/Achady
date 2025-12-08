import React, { useState, useEffect } from 'react';
import { getLogs } from '../services/api';
import { LogEntry } from '../types';
import { List, CheckCircle, XCircle, Clock, RefreshCcw } from 'lucide-react';

export const LogsTable: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="table-wrapper">
      <div className="p-6 border-b border-slate-700/50 bg-slate-900/30 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <List className="w-6 h-6 text-orange-500" />
            Logs de Envio
        </h2>
        <button onClick={fetchLogs} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="">
                <tr>
                    <th className="p-4">Data/Hora</th>
                    <th className="p-4">Grupo</th>
                    <th className="p-4">Produto</th>
                    <th className="p-4">Preço</th>
                    <th className="p-4">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
                {logs.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum registro encontrado.</td>
                    </tr>
                ) : (
                    logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-slate-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-4 font-medium text-slate-300">{log.groupName}</td>
                            <td className="p-4 text-slate-400 max-w-[200px] truncate" title={log.productTitle}>{log.productTitle}</td>
                            <td className="p-4 text-slate-200 font-semibold">{log.price}</td>
                            <td className="p-4">
                                {log.status === 'SENT' && <span className="inline-flex items-center gap-1 text-green-300 bg-green-900/20 px-2 py-1 rounded-full text-xs font-medium border border-green-900/30"><CheckCircle className="w-3 h-3"/> Enviado</span>}
                                {log.status === 'ERROR' && <span className="inline-flex items-center gap-1 text-red-300 bg-red-900/20 px-2 py-1 rounded-full text-xs font-medium border border-red-900/30"><XCircle className="w-3 h-3"/> Erro</span>}
                                {log.status === 'PENDING' && <span className="inline-flex items-center gap-1 text-yellow-300 bg-yellow-900/20 px-2 py-1 rounded-full text-xs font-medium border border-yellow-900/30"><Clock className="w-3 h-3"/> Pendente</span>}
                                {log.errorMessage && <div className="text-[10px] text-red-400 mt-1 max-w-[150px] truncate">{log.errorMessage}</div>}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};