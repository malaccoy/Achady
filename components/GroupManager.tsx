import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup, joinGroup, updateGroup, sendTestMessage } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, ToggleLeft, ToggleRight, Loader2, LogIn, AlertCircle, Settings, Save, XCircle, Send, Tag, X, Sparkles } from 'lucide-react';

// Suggested categories
const CATEGORY_SUGGESTIONS = [
  'Casa & Decoração',
  'Beleza & Cosméticos',
  'Eletrônicos',
  'Moda & Acessórios',
  'Mães & Bebês',
  'Esporte & Fitness',
  'Livros & Papelaria',
  'Alimentos & Bebidas',
  'Pet Shop',
  'Automotivo',
  'Ferramentas',
  'Saúde & Bem-estar'
];

// Quick blacklist suggestions
const BLACKLIST_SUGGESTIONS = ['usado', 'seminovo', 'capinha', 'película', 'defeito', 'danificado'];

type FilterTab = 'all' | 'active' | 'paused';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  
  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null);

  // Editing states
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [editNegative, setEditNegative] = useState<string[]>([]);
  const [editNegativeInput, setEditNegativeInput] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const data = await getGroups();
    setGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Filter groups based on tab
  useEffect(() => {
    if (filterTab === 'all') {
      setFilteredGroups(groups);
    } else if (filterTab === 'active') {
      setFilteredGroups(groups.filter(g => g.active));
    } else {
      setFilteredGroups(groups.filter(g => !g.active));
    }
  }, [groups, filterTab]);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupLink) return;
    setAdding(true);
    try {
      await addGroup(newGroupLink);
      // Update with category if provided
      const newGroups = await getGroups();
      if (newGroupCategory && newGroups.length > 0) {
        const lastGroup = newGroups[newGroups.length - 1];
        await updateGroup(lastGroup.id, { category: newGroupCategory });
      }
      setNewGroupLink('');
      setNewGroupCategory('');
      await fetchGroups();
    } catch (err) {
      alert("Erro ao adicionar grupo");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string) => {
    const updatedGroups = groups.map(g => g.id === id ? { ...g, active: !g.active } : g);
    setGroups(updatedGroups); 
    try {
        await toggleGroup(id);
    } catch (e) {
        await fetchGroups(); 
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Tem certeza que deseja remover este grupo?")) return;
    try {
        await deleteGroup(id);
        setGroups(groups.filter(g => g.id !== id));
    } catch(e) {
        alert("Erro ao deletar");
    }
  };

  const handleJoin = async (id: string) => {
      setJoiningId(id);
      try {
          await joinGroup(id);
          alert("Sucesso! O bot entrou no grupo.");
          await fetchGroups();
      } catch (e) {
          alert("Erro ao entrar no grupo. Verifique se o Bot está conectado (QR Code) e se o link é válido.");
      } finally {
          setJoiningId(null);
      }
  };

  const toggleExpand = (group: Group) => {
      if (expandedId === group.id) {
          setExpandedId(null);
      } else {
          setExpandedId(group.id);
          setEditKeywords(group.keywords || []);
          setEditKeywordInput('');
          setEditNegative(group.negativeKeywords || []);
          setEditNegativeInput('');
          setEditCategory(group.category || '');
      }
  };

  const handleSaveSettings = async (id: string) => {
      setSavingSettings(true);
      try {
          await updateGroup(id, { 
            keywords: editKeywords, 
            negativeKeywords: editNegative,
            category: editCategory 
          });
          
          // Update local state
          setGroups(groups.map(g => g.id === id ? { 
            ...g, 
            keywords: editKeywords, 
            negativeKeywords: editNegative,
            category: editCategory 
          } : g));
          setExpandedId(null);
      } catch (e) {
          alert("Erro ao salvar configurações do grupo.");
      } finally {
          setSavingSettings(false);
      }
  };

  const handleTestMessage = async (id: string) => {
    setTestingId(id);
    setTestFeedback(null);
    try {
      const result = await sendTestMessage(id);
      setTestFeedback({ id, message: result.message, type: 'success' });
      await fetchGroups(); // Refresh to get updated lastMessageSent
      setTimeout(() => setTestFeedback(null), 5000);
    } catch (e: any) {
      setTestFeedback({ id, message: e.message || 'Erro ao enviar teste', type: 'error' });
      setTimeout(() => setTestFeedback(null), 5000);
    } finally {
      setTestingId(null);
    }
  };

  // Keyword chip handlers
  const addKeyword = () => {
    const trimmed = editKeywordInput.trim();
    if (trimmed && !editKeywords.includes(trimmed)) {
      setEditKeywords([...editKeywords, trimmed]);
      setEditKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setEditKeywords(editKeywords.filter(k => k !== keyword));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // Negative keyword chip handlers
  const addNegative = () => {
    const trimmed = editNegativeInput.trim();
    if (trimmed && !editNegative.includes(trimmed)) {
      setEditNegative([...editNegative, trimmed]);
      setEditNegativeInput('');
    }
  };

  const removeNegative = (keyword: string) => {
    setEditNegative(editNegative.filter(k => k !== keyword));
  };

  const handleNegativeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNegative();
    }
  };

  const addQuickBlacklist = () => {
    const newItems = BLACKLIST_SUGGESTIONS.filter(item => !editNegative.includes(item));
    setEditNegative([...editNegative, ...newItems]);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Add Group Card */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-orange-500" />
          Adicionar Grupo
        </h2>
        <form onSubmit={handleAddGroup} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">Link de Convite do Grupo</label>
              <div className="relative">
                  <LinkIcon className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                      value={newGroupLink}
                      onChange={(e) => setNewGroupLink(e.target.value)}
                      required
                  />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">Categoria (opcional)</label>
              <input
                  type="text"
                  list="categories"
                  placeholder="Ex: Casa & Decoração, Beleza, etc"
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value)}
              />
              <datalist id="categories">
                {CATEGORY_SUGGESTIONS.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={adding}
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
          >
            {adding ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-5 h-5" />}
            Salvar Grupo
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">
            Após salvar, clique em "Entrar" na lista abaixo para que o bot entre no grupo automaticamente.
        </p>
      </div>

      {/* Groups Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-semibold text-slate-300">Grupos Cadastrados</h3>
              <p className="text-xs text-slate-500 mt-0.5">{groups.length} grupos no total</p>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTab === 'all' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Todos ({groups.length})
              </button>
              <button
                onClick={() => setFilterTab('active')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTab === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Ativos ({groups.filter(g => g.active).length})
              </button>
              <button
                onClick={() => setFilterTab('paused')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTab === 'paused' 
                    ? 'bg-slate-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Pausados ({groups.filter(g => !g.active).length})
              </button>
            </div>
          </div>
        </div>
        
        {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando grupos...</div>
        ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {filterTab === 'all' ? 'Nenhum grupo cadastrado.' : `Nenhum grupo ${filterTab === 'active' ? 'ativo' : 'pausado'}.`}
            </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Nome do Grupo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Categoria</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Keywords</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Última Mensagem</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredGroups.map(group => (
                  <React.Fragment key={group.id}>
                    <tr className="hover:bg-slate-800/20 transition-colors">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
                            {group.name || "Grupo sem nome"}
                          </span>
                          {!group.chatId && (
                            <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded border border-red-900/50 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Fora
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {group.chatId ? (
                            <span className="text-xs bg-green-900/30 text-green-300 px-2 py-1 rounded border border-green-900/50 flex items-center gap-1">
                              {group.active ? 'Conectado' : 'Pausado'}
                            </span>
                          ) : (
                            <span className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded border border-red-900/50">
                              Bot fora
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Category */}
                      <td className="px-4 py-3">
                        {group.category ? (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {group.category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">Sem categoria</span>
                        )}
                      </td>
                      
                      {/* Keywords Count */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-blue-300 bg-blue-900/20 px-2 py-1 rounded border border-blue-900/30">
                          {(group.keywords || []).length} palavras
                        </span>
                      </td>
                      
                      {/* Last Message */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400">
                          {formatDate(group.lastMessageSent)}
                        </span>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {!group.chatId && (
                            <button
                              onClick={() => handleJoin(group.id)}
                              disabled={joiningId === group.id}
                              className="text-xs bg-blue-900/30 text-blue-300 border border-blue-900/50 hover:bg-blue-900/50 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                              title="Entrar no grupo"
                            >
                              {joiningId === group.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <LogIn className="w-3 h-3"/>}
                              Entrar
                            </button>
                          )}

                          {group.chatId && (
                            <button
                              onClick={() => handleTestMessage(group.id)}
                              disabled={testingId === group.id}
                              className="text-xs bg-purple-900/30 text-purple-300 border border-purple-900/50 hover:bg-purple-900/50 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                              title="Enviar mensagem de teste"
                            >
                              {testingId === group.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                              Teste
                            </button>
                          )}

                          <button 
                            onClick={() => handleToggle(group.id)}
                            className={`p-2 rounded-full transition-colors ${
                              group.active 
                                ? 'bg-green-900/30 text-green-300 hover:bg-green-900/50' 
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                            title={group.active ? 'Pausar grupo' : 'Ativar grupo'}
                          >
                            {group.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          
                          <button
                            onClick={() => toggleExpand(group)}
                            className={`p-2 rounded-full transition-colors ${
                              expandedId === group.id 
                                ? 'bg-orange-500/20 text-orange-400' 
                                : 'text-slate-400 hover:bg-slate-800'
                            }`}
                            title="Configurar grupo"
                          >
                            <Settings className="w-5 h-5" />
                          </button>

                          <button 
                            onClick={() => handleDelete(group.id)}
                            className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/30 rounded-full transition-colors"
                            title="Excluir grupo"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Test Feedback Row */}
                    {testFeedback && testFeedback.id === group.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-2">
                          <div className={`text-xs p-2 rounded ${
                            testFeedback.type === 'success' 
                              ? 'bg-green-900/20 text-green-300 border border-green-900/50' 
                              : 'bg-red-900/20 text-red-300 border border-red-900/50'
                          }`}>
                            {testFeedback.message}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded Config Section */}
                    {expandedId === group.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-950/50 border-t border-slate-800">
                          <div className="p-6 space-y-4">
                            {/* Category */}
                            <div>
                              <label className="block text-xs font-medium text-orange-300 mb-2">
                                Categoria do Grupo
                              </label>
                              <input
                                type="text"
                                list="edit-categories"
                                placeholder="Ex: Casa & Decoração, Beleza, etc"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:border-orange-500 outline-none"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                              />
                              <datalist id="edit-categories">
                                {CATEGORY_SUGGESTIONS.map(cat => (
                                  <option key={cat} value={cat} />
                                ))}
                              </datalist>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                              {/* Keywords */}
                              <div>
                                <label className="block text-xs font-medium text-blue-300 mb-2">
                                  Palavras-chave Específicas (Prioritárias)
                                </label>
                                <p className="text-[10px] text-slate-500 mb-2">
                                  Se vazio, usa as gerais. Separe por vírgula. Ex: casa, sala, decoração, banheiro
                                </p>
                                
                                {/* Chips Display */}
                                <div className="flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 bg-slate-900 border border-slate-700 rounded">
                                  {editKeywords.map(keyword => (
                                    <span 
                                      key={keyword} 
                                      className="inline-flex items-center gap-1 bg-blue-900/30 text-blue-300 border border-blue-900/50 px-2 py-1 rounded text-xs"
                                    >
                                      {keyword}
                                      <button 
                                        onClick={() => removeKeyword(keyword)}
                                        className="hover:text-blue-100"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                
                                {/* Input */}
                                <div className="flex gap-2">
                                  <input 
                                    value={editKeywordInput}
                                    onChange={(e) => setEditKeywordInput(e.target.value)}
                                    onKeyDown={handleKeywordKeyDown}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                    placeholder="Digite e pressione Enter"
                                  />
                                  <button
                                    onClick={addKeyword}
                                    className="px-3 py-2 bg-blue-900/30 text-blue-300 border border-blue-900/50 rounded hover:bg-blue-900/50 text-xs font-medium"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                              </div>

                              {/* Blacklist */}
                              <div>
                                <label className="block text-xs font-medium text-red-300 mb-2">
                                  Blacklist (Palavras Negativas)
                                </label>
                                <p className="text-[10px] text-slate-500 mb-2">
                                  Se o título tiver QUALQUER uma dessas palavras, o produto é ignorado.
                                </p>
                                
                                {/* Chips Display */}
                                <div className="flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 bg-slate-900 border border-slate-700 rounded">
                                  {editNegative.map(keyword => (
                                    <span 
                                      key={keyword} 
                                      className="inline-flex items-center gap-1 bg-red-900/30 text-red-300 border border-red-900/50 px-2 py-1 rounded text-xs"
                                    >
                                      {keyword}
                                      <button 
                                        onClick={() => removeNegative(keyword)}
                                        className="hover:text-red-100"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                
                                {/* Input */}
                                <div className="flex gap-2 mb-2">
                                  <input 
                                    value={editNegativeInput}
                                    onChange={(e) => setEditNegativeInput(e.target.value)}
                                    onKeyDown={handleNegativeKeyDown}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                                    placeholder="Digite e pressione Enter"
                                  />
                                  <button
                                    onClick={addNegative}
                                    className="px-3 py-2 bg-red-900/30 text-red-300 border border-red-900/50 rounded hover:bg-red-900/50 text-xs font-medium"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                                
                                {/* Quick Suggestions Button */}
                                <button
                                  onClick={addQuickBlacklist}
                                  className="w-full px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded hover:bg-slate-700 text-xs font-medium flex items-center justify-center gap-2"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Sugestões rápidas: {BLACKLIST_SUGGESTIONS.join(', ')}
                                </button>
                              </div>
                            </div>

                            {/* Save/Cancel Buttons */}
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                              <button 
                                onClick={() => setExpandedId(null)}
                                className="text-xs text-slate-400 hover:text-white px-4 py-2"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleSaveSettings(group.id)}
                                disabled={savingSettings}
                                className="text-xs bg-slate-100 hover:bg-white text-slate-900 px-6 py-2 rounded font-medium flex items-center gap-2"
                              >
                                {savingSettings ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                                Salvar Filtros
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
