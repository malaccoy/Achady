import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup, joinGroup, updateGroup, sendTestMessage } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, Loader2, LogIn, AlertCircle, Settings, Save, X, Send, Lightbulb, Tag, Filter } from 'lucide-react';

// Suggested categories
const SUGGESTED_CATEGORIES = [
  'Casa & Decoração',
  'Beleza',
  'Eletrônicos',
  'Mães',
  'Moda',
  'Esportes',
  'Infantil',
  'Pet',
  'Automotivo',
  'Games',
];

// Quick blacklist suggestions
const QUICK_BLACKLIST_TERMS = ['usado', 'seminovo', 'capinha', 'película'];

type FilterType = 'all' | 'active' | 'paused';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(false);
  
  // Add Group Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('');
  const [adding, setAdding] = useState(false);
  
  // Edit Modal
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editNegative, setEditNegative] = useState<string[]>([]);
  const [editCategory, setEditCategory] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [negativeInput, setNegativeInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Actions
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const data = await getGroups();
    setGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    // Apply filter
    let filtered = groups;
    if (filter === 'active') {
      filtered = groups.filter(g => g.active);
    } else if (filter === 'paused') {
      filtered = groups.filter(g => !g.active);
    }
    setFilteredGroups(filtered);
  }, [groups, filter]);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupLink) return;
    setAdding(true);
    try {
      await addGroup(newGroupLink);
      setNewGroupLink('');
      setNewGroupCategory('');
      setShowAddForm(false);
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

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setEditKeywords(group.keywords || []);
    setEditNegative(group.negativeKeywords || []);
    setEditCategory(group.category || '');
    setKeywordInput('');
    setNegativeInput('');
  };

  const closeEditModal = () => {
    setEditingGroup(null);
    setEditKeywords([]);
    setEditNegative([]);
    setEditCategory('');
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      const newKeywords = keywordInput.split(',').map(k => k.trim()).filter(k => k);
      setEditKeywords([...editKeywords, ...newKeywords]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== index));
  };

  const addNegative = () => {
    if (negativeInput.trim()) {
      const newNegatives = negativeInput.split(',').map(k => k.trim()).filter(k => k);
      setEditNegative([...editNegative, ...newNegatives]);
      setNegativeInput('');
    }
  };

  const removeNegative = (index: number) => {
    setEditNegative(editNegative.filter((_, i) => i !== index));
  };

  const addQuickBlacklist = () => {
    const newTerms = QUICK_BLACKLIST_TERMS.filter(term => !editNegative.includes(term));
    setEditNegative([...editNegative, ...newTerms]);
  };

  const handleSaveSettings = async () => {
    if (!editingGroup) return;
    setSavingSettings(true);
    try {
      await updateGroup(editingGroup.id, { 
        keywords: editKeywords, 
        negativeKeywords: editNegative,
        category: editCategory || undefined
      });
      
      // Update local state
      setGroups(groups.map(g => 
        g.id === editingGroup.id 
          ? { ...g, keywords: editKeywords, negativeKeywords: editNegative, category: editCategory || undefined } 
          : g
      ));
      closeEditModal();
    } catch (e) {
      alert("Erro ao salvar configurações do grupo.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTest = async (group: Group) => {
    setTestingId(group.id);
    setTestResult(null);
    try {
      const result = await sendTestMessage(group.id);
      setTestResult({ id: group.id, success: true, message: `Teste enviado: ${result.productTitle}` });
      await fetchGroups(); // Refresh to get updated lastMessageSent
      setTimeout(() => setTestResult(null), 5000);
    } catch (e: any) {
      setTestResult({ id: group.id, success: false, message: e.message || 'Erro ao enviar teste' });
      setTimeout(() => setTestResult(null), 5000);
    } finally {
      setTestingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusBadge = (group: Group) => {
    if (!group.chatId) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-900/30 text-red-300 border border-red-900/50">Bot Fora</span>;
    }
    if (!group.active) {
      return <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 border border-slate-600">Pausado</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-green-900/30 text-green-300 border border-green-900/50">Conectado</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />
            Grupos WhatsApp
          </h2>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Adicionar Grupo
          </button>
        </div>

        {/* Add Group Form */}
        {showAddForm && (
          <form onSubmit={handleAddGroup} className="border-t border-slate-700 pt-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Link de Convite do Grupo *</label>
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
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Categoria (opcional)</label>
                <input
                  type="text"
                  list="categories"
                  placeholder="Ex: Casa & Decoração, Beleza..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value)}
                />
                <datalist id="categories">
                  {SUGGESTED_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                type="submit" 
                disabled={adding}
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                {adding ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-4 h-4" />}
                Salvar Grupo
              </button>
              <button 
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white px-4 py-2"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Após salvar, clique em "Entrar" na tabela abaixo para que o bot entre no grupo automaticamente.
            </p>
          </form>
        )}
      </div>

      {/* Groups Table */}
      <div className="card overflow-hidden">
        {/* Filter Tabs */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Todos ({groups.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Ativos ({groups.filter(g => g.active).length})
              </button>
              <button
                onClick={() => setFilter('paused')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'paused' 
                    ? 'bg-slate-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Pausados ({groups.filter(g => !g.active).length})
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="w-4 h-4" />
              {filteredGroups.length} grupo(s)
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando grupos...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {filter === 'all' ? 'Nenhum grupo cadastrado.' : `Nenhum grupo ${filter === 'active' ? 'ativo' : 'pausado'}.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Categoria</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Keywords</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Última Mensagem</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredGroups.map(group => (
                  <tr key={group.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-200">{group.name || "Grupo sem nome"}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{group.link}</div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(group)}
                    </td>
                    <td className="px-4 py-3">
                      {group.category ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-purple-900/20 text-purple-300 border border-purple-900/30">
                          <Tag className="w-3 h-3" />
                          {group.category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs rounded-full bg-blue-900/20 text-blue-300 border border-blue-900/30">
                        {(group.keywords?.length || 0)}
                      </span>
                      {(group.negativeKeywords?.length || 0) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs rounded-full bg-red-900/20 text-red-300 border border-red-900/30">
                          🚫 {group.negativeKeywords?.length}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-400">{formatDate(group.lastMessageSent)}</div>
                    </td>
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
                          </button>
                        )}
                        
                        {group.chatId && (
                          <button
                            onClick={() => handleSendTest(group)}
                            disabled={testingId === group.id}
                            className="text-xs bg-purple-900/30 text-purple-300 border border-purple-900/50 hover:bg-purple-900/50 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                            title="Enviar mensagem de teste"
                          >
                            {testingId === group.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                          </button>
                        )}
                        
                        <button 
                          onClick={() => handleToggle(group.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            group.active 
                              ? 'bg-green-900/30 text-green-300 border border-green-900/50 hover:bg-green-900/50' 
                              : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                          }`}
                          title={group.active ? 'Pausar' : 'Ativar'}
                        >
                          {group.active ? '✓' : '⏸'}
                        </button>
                        
                        <button
                          onClick={() => openEditModal(group)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-orange-400 hover:bg-orange-500/20 transition-colors"
                          title="Configurar grupo"
                        >
                          <Settings className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => handleDelete(group.id)}
                          className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                          title="Excluir grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Test Result Feedback */}
                      {testResult && testResult.id === group.id && (
                        <div className={`mt-2 text-xs p-2 rounded ${
                          testResult.success 
                            ? 'bg-green-900/30 text-green-300 border border-green-900/50' 
                            : 'bg-red-900/30 text-red-300 border border-red-900/50'
                        }`}>
                          {testResult.message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-100">Configurar Grupo: {editingGroup.name}</h3>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Categoria do Grupo</label>
                <input
                  type="text"
                  list="edit-categories"
                  placeholder="Ex: Casa & Decoração, Beleza..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-white"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
                <datalist id="edit-categories">
                  {SUGGESTED_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <p className="text-xs text-slate-500 mt-1">Organize seus grupos por categoria para facilitar o gerenciamento.</p>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-blue-300 mb-2">
                  Palavras-chave Específicas (Prioritárias)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Separe por vírgula. Ex: casa, sala, decoração, banheiro
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Digite as palavras-chave..."
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-white"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editKeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-900/30 text-blue-300 border border-blue-900/50 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="hover:text-blue-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {editKeywords.length === 0 && (
                    <span className="text-xs text-slate-500">Nenhuma keyword adicionada. Usa as palavras-chave gerais.</span>
                  )}
                </div>
              </div>

              {/* Blacklist */}
              <div>
                <label className="block text-sm font-medium text-red-300 mb-2">
                  Blacklist (Palavras Negativas)
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Se o título tiver QUALQUER uma dessas palavras, o produto é ignorado.
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Ex: usado, seminovo, capinha..."
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-white"
                    value={negativeInput}
                    onChange={(e) => setNegativeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addNegative();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addNegative}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editNegative.map((negative, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/30 text-red-300 border border-red-900/50 rounded-full text-sm"
                    >
                      {negative}
                      <button
                        type="button"
                        onClick={() => removeNegative(index)}
                        className="hover:text-red-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {editNegative.length === 0 && (
                    <span className="text-xs text-slate-500">Nenhuma palavra na blacklist.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addQuickBlacklist}
                  className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  Sugestões rápidas: {QUICK_BLACKLIST_TERMS.join(', ')}
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-slate-900">
              <button 
                onClick={closeEditModal}
                className="text-slate-400 hover:text-white px-4 py-2"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-slate-100 hover:bg-white text-slate-900 px-6 py-2 rounded-md font-medium flex items-center gap-2"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
