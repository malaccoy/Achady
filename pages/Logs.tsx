import React, { useEffect, useState } from 'react';
import { Card, Button } from '../components/UI';
import { RefreshCw, FileText, CheckCheck, TrendingUp, ImageIcon, ExternalLink } from 'lucide-react';
import type { MessageLog } from '../types';
import { useNavigate } from 'react-router-dom';

const FIXED_USER_ID = "1";

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs/${FIXED_USER_ID}`);
      const data = await res.json();
      
      if (data.logs) {
        // Mapear logs do servidor para o tipo da UI
        const mapped: MessageLog[] = data.logs.map((l: any) => ({
          id: l.id.toString(),
          grupoId: '',
          grupoNome: l.groupName || 'Grupo',
          whatsappLink: '',
          categoria: 'Geral',
          produtoId: '',
          titulo: l.productName || 'Oferta',
          precoOriginal: 0,
          preco: Number(l.price) || 0,
          descontoPercentual: Number(l.discount) || 0,
          imagem: '',
          linkAfiliado: l.offerLink || '#',
          mensagemEnviada: 'Oferta enviada via automação.',
          enviadoEm: l.sentAt
        }));
        setLogs(mapped);
      }
    } catch (err) {
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

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (mins < 1) return 'Agora';
    if (mins < 60) return `${mins} min atrás`;
    return `${hours}h atrás`;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Histórico de Envios</h2>
        <Button variant="secondary" onClick={fetchLogs} isLoading={loading}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden" noPadding>
        {loading && logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">Carregando histórico...</div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
             <FileText className="w-12 h-12 text-slate-300 mb-4" />
             <p className="text-slate-900 font-medium">Nenhum envio registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Grupo</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Preço</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Link</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {getTimeAgo(log.enviadoEm)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {log.grupoNome}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate" title={log.titulo}>
                      {log.titulo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                      {formatCurrency(log.preco)}
                      {log.descontoPercentual > 0 && (
                        <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                          -{log.descontoPercentual}%
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a href={log.linkAfiliado} target="_blank" rel="noreferrer" className="text-achady-purple hover:underline flex items-center gap-1">
                        Abrir <ExternalLink className="w-3 h-3" />
                      </a>
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
