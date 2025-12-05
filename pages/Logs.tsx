import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '../components/UI';
import { RefreshCw, FileText, Search, ExternalLink, Filter, TrendingUp, Tag, Calendar, Image as ImageIcon, Copy, CheckCheck } from 'lucide-react';
import type { MessageLog } from '../types';
import { useNavigate } from 'react-router-dom';

const FIXED_USER_ID = "1";

export const Logs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterGroup, setFilterGroup] = useState('todos');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      // Endpoint updated to match new server.js: /logs/:userId
      const res = await fetch(`/api/logs/${FIXED_USER_ID}`);
      const data = await res.json();
      
      if (data.ok && Array.isArray(data.logs)) {
        // Map new server structure to old UI structure
        const mappedLogs: MessageLog[] = data.logs.map((l: any) => ({
            id: l.id.toString(),
            grupoId: '', // Server doesn't send group ID here
            grupoNome: l.groupName,
            whatsappLink: '',
            categoria: 'Geral', // Server doesn't explicitly store log category yet, maybe infer from group?
            produtoId: '',
            titulo: l.productName,
            precoOriginal: l.priceOriginal,
            preco: l.priceMin,
            descontoPercentual: l.discountRate,
            imagem: '', // Server doesn't seem to store image URL in logs table based on provided code
            linkAfiliado: l.offerLink,
            mensagemEnviada: 'Mensagem enviada', // Simplified
            enviadoEm: l.sentAt
        }));
        setLogs(mappedLogs);
      } else {
        setLogs([]);
        if (!data.ok) console.warn("Logs response error:", data);
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
    if (!val) return 'R$ 0,00';
    // Backend returns string sometimes in sqlite, ensure number
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `${mins} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  // Lógica de Filtragem
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (log.grupoNome && log.grupoNome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'todos' || log.categoria === filterCategory;
    const matchesGroup = filterGroup === 'todos' || log.grupoNome === filterGroup;

    return matchesSearch && matchesCategory && matchesGroup;
  });

  // Estatísticas Rápidas
  const totalEnviado = logs.length;
  const gruposAtivos = new Set(logs.map(l => l.grupoNome)).size;
  const descontoMedio = logs.length > 0 
    ? Math.round(logs.reduce((acc, curr) => acc + (curr.descontoPercentual || 0), 0) / logs.length) 
    : 0;

  // Listas Únicas para Dropdowns
  const uniqueCategories = Array.from(new Set(logs.map(l => l.categoria || 'Geral')));
  const uniqueGroups = Array.from(new Set(logs.map(l => l.grupoNome || 'Desconhecido')));

  return (
    <div className="space-y-8">
      {/* Header com Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total de Envios</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalEnviado}</span>
            <span className="text-xs text-emerald-600 font-medium mb-1.5 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +12%
            </span>
          </div>
        </div>
        <div className="md:col-span-1 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Grupos Atingidos</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-900">{gruposAtivos}</span>
          </div>
        </div>
        <div className="md:col-span-1 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Média Desconto</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-achady-purple">{descontoMedio}%</span>
            <span className="text-xs text-slate-400 mb-1.5">OFF</span>
          </div>
        </div>
        <div className="md:col-span-1 flex flex-col justify-end gap-3">
           <Button variant="secondary" fullWidth onClick={fetchLogs} isLoading={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Filtros e Tabela */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar produto ou grupo..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-achady-purple/20 focus:border-achady-purple transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <select 
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-achady-purple"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="todos">Todas Categorias</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select 
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-achady-purple"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="todos">Todos Grupos</option>
              {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <Card className="overflow-hidden" noPadding>
          {loading && logs.length === 0 ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-8 h-8 text-achady-purple animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Sincronizando registros...</p>
            </div>
          ) : error ? (
             <div className="p-12 text-center text-red-500 bg-red-50">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-slate-900 font-medium">Nenhum registro encontrado</p>
               <p className="text-slate-400 text-sm mt-1">Tente ajustar seus filtros de busca.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50/80 text-left">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Oferta</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Envio</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                            {log.imagem ? (
                              <img src={log.imagem} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="max-w-[200px]">
                            <p className="text-sm font-medium text-slate-900 truncate" title={log.titulo}>
                              {log.titulo}
                            </p>
                            <a href={log.linkAfiliado} target="_blank" rel="noreferrer" className="text-xs text-achady-purple hover:underline flex items-center gap-1 mt-0.5">
                              Link Shopee <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex flex-col">
                           <span className="text-sm text-slate-700 font-medium">{log.grupoNome}</span>
                           <span className="inline-flex items-center mt-1 w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wide border border-indigo-100">
                             {log.categoria || 'Geral'}
                           </span>
                         </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-sm font-bold text-slate-900">{formatCurrency(log.preco)}</span>
                             {log.descontoPercentual && (
                               <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                 -{log.descontoPercentual}%
                               </span>
                             )}
                          </div>
                          {log.precoOriginal && (
                            <span className="text-xs text-slate-400 line-through">
                              {formatCurrency(log.precoOriginal)}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-500">
                          <CheckCheck className="w-4 h-4 text-emerald-500" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">Enviado</span>
                            <span className="text-xs opacity-70">{getTimeAgo(log.enviadoEm)}</span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                         <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                            Ver Detalhes
                         </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal de Detalhes Melhorado */}
      {selectedLog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Coluna Visual */}
            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-100 p-6 flex flex-col items-center justify-center text-center">
              <div className="w-40 h-40 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden mb-4">
                 {selectedLog.imagem ? (
                   <img src={selectedLog.imagem} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-300">
                     <ImageIcon className="w-10 h-10" />
                   </div>
                 )}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 mb-2">{selectedLog.titulo}</h3>
              {selectedLog.descontoPercentual && (
                <div className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                   {selectedLog.descontoPercentual}% OFF
                </div>
              )}
              <a 
                 href={selectedLog.linkAfiliado} 
                 target="_blank" 
                 rel="noreferrer"
                 className="w-full py-2 bg-achady-purple text-white rounded-lg text-xs font-bold hover:bg-achady-blue transition-colors"
               >
                 Abrir Oferta
               </a>
            </div>

            {/* Coluna Dados */}
            <div className="w-full md:w-2/3 flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                   <h3 className="font-bold text-slate-900">Detalhes do Disparo</h3>
                   <p className="text-xs text-slate-500">{new Date(selectedLog.enviadoEm).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                   <Filter className="w-4 h-4 rotate-45" /> {/* Close icon visual hack using filter icon or just X */}
                   <span className="sr-only">Fechar</span>
                   ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase">Grupo</p>
                      <p className="font-medium text-slate-800">{selectedLog.grupoNome}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase">Categoria</p>
                      <p className="font-medium text-slate-800 capitalize">{selectedLog.categoria || 'Geral'}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">Mensagem Enviada</label>
                       <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedLog.mensagemEnviada);
                          alert('Copiado!');
                        }}
                        className="text-xs text-achady-purple hover:underline flex items-center gap-1"
                       >
                         <Copy className="w-3 h-3" /> Copiar Texto
                       </button>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl text-sm font-mono whitespace-pre-line border border-slate-200 text-slate-600 leading-relaxed">
                      {selectedLog.mensagemEnviada}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};