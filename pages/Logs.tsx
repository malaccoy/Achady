
import React, { useEffect, useState } from 'react';
import { Card, Button } from '../components/UI';
import { CheckCircle, XCircle, FileText, RefreshCw, Info } from 'lucide-react';
import type { AutomationLog } from '../types';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';

export const Logs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AutomationLog[]>([]);

  useEffect(() => {
    const userId = db.getCurrentUserId();
    if (!userId) {
      navigate('/login');
      return;
    }

    const loadLogs = () => {
      const logsDb = db.getLogs(userId);
      
      const finalLogs = logsDb.map(log => {
        let status: 'success' | 'error' | 'info' = 'error';
        if (log.status === 'sucesso') status = 'success';
        else if (log.status === 'formatado') status = 'info';
        
        return {
          id: log.id,
          timestamp: log.dataHora,
          groupName: log.grupo,
          messageSnippet: log.mensagem,
          status: status
        };
      });
      
      setLogs(finalLogs);
    };

    loadLogs();
  }, [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Logs de Atividade</h1>
          <p className="text-slate-500 mt-1">Histórico completo das mensagens enviadas e geradas pelo sistema.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden" noPadding>
        {logs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-slate-500 font-medium">Nenhum registro encontrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/80">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Horário</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo Alvo</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Conteúdo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.status === 'success' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle className="w-3 h-3 mr-1.5" /> Enviado
                        </span>
                      )}
                      {log.status === 'error' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          <XCircle className="w-3 h-3 mr-1.5" /> Falha
                        </span>
                      )}
                      {log.status === 'info' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          <Info className="w-3 h-3 mr-1.5" /> Formatado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="text-slate-400 font-normal text-xs ml-2">{new Date(log.timestamp).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {log.groupName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="truncate block w-full">{log.messageSnippet}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
