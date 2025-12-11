import React, { useState, useEffect } from 'react';
import { getReports } from '../services/api';
import { ReportsData } from '../types';
import { BarChart3, TrendingUp, Users, Filter, Calendar, RefreshCcw, Package, XCircle, Search } from 'lucide-react';

type DateFilter = 'today' | '7days' | '30days';

export const Reports: React.FC = () => {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const reports = await getReports(dateFilter, groupFilter !== 'all' ? groupFilter : undefined);
      setData(reports);
      
      // Extract unique groups for filter dropdown
      if (reports.dailyMetrics.offersByGroup.length > 0) {
        const groups = reports.dailyMetrics.offersByGroup.map(g => g.groupName);
        setAvailableGroups(groups);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [dateFilter, groupFilter]);

  const getDateLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Hoje';
      case '7days': return 'Últimos 7 dias';
      case '30days': return 'Últimos 30 dias';
      default: return 'Hoje';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-bold text-slate-100">Relatórios</h2>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="bg-transparent border-none text-sm text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="today">Hoje</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
            </select>
          </div>

          {/* Group Filter */}
          {availableGroups.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="bg-transparent border-none text-sm text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos os grupos</option>
                {availableGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
          >
            <RefreshCcw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : data ? (
        <>
          {/* Daily Metrics Cards */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Métricas - {getDateLabel()}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Offers Card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Ofertas Enviadas</span>
                  <Package className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-slate-100">{data.dailyMetrics.offersToday}</div>
                <div className="text-xs text-slate-500 mt-1">Total de produtos enviados</div>
              </div>

              {/* Groups Count Card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Grupos Ativos</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-slate-100">{data.dailyMetrics.offersByGroup.length}</div>
                <div className="text-xs text-slate-500 mt-1">Grupos que receberam ofertas</div>
              </div>

              {/* Blacklisted Card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Blacklist</span>
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-slate-100">{data.dailyMetrics.blacklistedCount}</div>
                <div className="text-xs text-slate-500 mt-1">Produtos ignorados</div>
              </div>

              {/* No Keywords Card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Sem Keywords</span>
                  <Search className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-slate-100">{data.dailyMetrics.noKeywordsCount}</div>
                <div className="text-xs text-slate-500 mt-1">Produtos sem match</div>
              </div>
            </div>
          </div>

          {/* Offers by Group */}
          {data.dailyMetrics.offersByGroup.length > 0 && (
            <div className="card">
              <div className="p-5 border-b border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  Ofertas por Grupo
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {data.dailyMetrics.offersByGroup.map((group, idx) => {
                    const maxCount = Math.max(...data.dailyMetrics.offersByGroup.map(g => g.count));
                    const percentage = (group.count / maxCount) * 100;
                    
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 font-medium truncate max-w-[60%]" title={group.groupName}>
                            {group.groupName}
                          </span>
                          <span className="text-sm font-bold text-slate-100">{group.count}</span>
                        </div>
                        <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Rankings Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Groups Ranking */}
            {data.rankings.topGroups.length > 0 && (
              <div className="table-wrapper">
                <div className="p-5 border-b border-slate-700/50 bg-slate-900/30">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Top Grupos - {getDateLabel()}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-4 w-12">#</th>
                        <th className="p-4">Grupo</th>
                        <th className="p-4 text-right">Mensagens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {data.rankings.topGroups.map((group, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-500/20 text-yellow-300' :
                              idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                              idx === 2 ? 'bg-orange-700/20 text-orange-300' :
                              'bg-slate-700/20 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 font-medium truncate max-w-[200px]" title={group.groupName}>
                            {group.groupName}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-100">{group.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Categories Ranking */}
            {data.rankings.topCategories.length > 0 && (
              <div className="table-wrapper">
                <div className="p-5 border-b border-slate-700/50 bg-slate-900/30">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-400" />
                    Top Categorias - {getDateLabel()}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-4 w-12">#</th>
                        <th className="p-4">Categoria</th>
                        <th className="p-4 text-right">Produtos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {data.rankings.topCategories.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-slate-700/20 text-slate-400">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 font-medium">{cat.category}</td>
                          <td className="p-4 text-right font-bold text-slate-100">{cat.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {data.dailyMetrics.offersToday === 0 && (
            <div className="card p-12 text-center">
              <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-2">Nenhum dado disponível</h3>
              <p className="text-sm text-slate-500">
                Não há ofertas enviadas no período selecionado. As métricas aparecerão aqui quando houver envios.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
