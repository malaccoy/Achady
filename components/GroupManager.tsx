import React, { useState, useEffect } from 'react';
import { Group, ShopeeSortType } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup, joinGroup, updateGroup, sendTestMessage } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, Loader2, LogIn, AlertCircle, Settings, Save, X, Send, Lightbulb, Tag, Filter } from 'lucide-react';
import { TagChip } from './TagChip';

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
  
  // New Shopee productOfferV2 fields
  const [editProductCatIds, setEditProductCatIds] = useState<(number | string)[]>([]);
  const [editSortType, setEditSortType] = useState<number>(ShopeeSortType.ITEM_SOLD_DESC);
  const [editMinDiscountPercent, setEditMinDiscountPercent] = useState<number | null>(null);
  const [editMinRating, setEditMinRating] = useState<number | null>(null);
  const [editMinSales, setEditMinSales] = useState<number | null>(null);
  const [categoryIdInput, setCategoryIdInput] = useState('');
  
  // Category rotation settings
  const [editRotationEnabled, setEditRotationEnabled] = useState<boolean>(true);
  const [editRotationEmptyThreshold, setEditRotationEmptyThreshold] = useState<number>(3);
  const [editRotationCooldownMinutes, setEditRotationCooldownMinutes] = useState<number>(15);
  
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
      await addGroup(newGroupLink, newGroupCategory || undefined);
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
    
    // Set new productOfferV2 fields
    setEditProductCatIds(group.productCatIds || []);
    setEditSortType(group.sortType || ShopeeSortType.ITEM_SOLD_DESC);
    setEditMinDiscountPercent(group.minDiscountPercent || null);
    setEditMinRating(group.minRating || null);
    setEditMinSales(group.minSales || null);
    setCategoryIdInput('');
    
    // Set rotation fields
    setEditRotationEnabled(group.rotationEnabled !== false); // Default true
    setEditRotationEmptyThreshold(group.rotationEmptyThreshold || 3);
    setEditRotationCooldownMinutes(group.rotationCooldownMinutes || 15);
  };

  const closeEditModal = () => {
    setEditingGroup(null);
    setEditKeywords([]);
    setEditNegative([]);
    setEditCategory('');
    
    // Reset new fields
    setEditProductCatIds([]);
    setEditSortType(ShopeeSortType.ITEM_SOLD_DESC);
    setEditMinDiscountPercent(null);
    setEditMinRating(null);
    setEditMinSales(null);
    setCategoryIdInput('');
    
    // Reset rotation fields
    setEditRotationEnabled(true);
    setEditRotationEmptyThreshold(3);
    setEditRotationCooldownMinutes(15);
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
  
  const addCategoryId = () => {
    const input = categoryIdInput.trim();
    if (!input) return;
    
    // Check if input is purely numeric
    const isNumeric = /^\d+$/.test(input);
    const value = isNumeric ? parseInt(input, 10) : input;
    
    // Check for duplicates by comparing the normalized string representation
    const valueStr = String(value);
    const isDuplicate = editProductCatIds.some(item => String(item) === valueStr);
    
    if (isDuplicate) {
      alert('Esta categoria já foi adicionada.');
      return;
    }
    
    // Add the value (number if numeric, string otherwise)
    setEditProductCatIds([...editProductCatIds, value]);
    setCategoryIdInput('');
  };
  
  const removeCategoryId = (index: number) => {
    setEditProductCatIds(editProductCatIds.filter((_, i) => i !== index));
  };

  const handleSaveSettings = async () => {
    if (!editingGroup) return;
    setSavingSettings(true);
    try {
      await updateGroup(editingGroup.id, { 
        keywords: editKeywords, 
        negativeKeywords: editNegative,
        category: editCategory || undefined,
        productCatIds: editProductCatIds,
        sortType: editSortType,
        minDiscountPercent: editMinDiscountPercent,
        minRating: editMinRating,
        minSales: editMinSales,
        // Rotation settings
        rotationEnabled: editRotationEnabled,
        rotationEmptyThreshold: editRotationEmptyThreshold,
        rotationCooldownMinutes: editRotationCooldownMinutes
      });
      
      // Update local state
      setGroups(groups.map(g => 
        g.id === editingGroup.id 
          ? { 
              ...g, 
              keywords: editKeywords, 
              negativeKeywords: editNegative, 
              category: editCategory || undefined,
              productCatIds: editProductCatIds,
              sortType: editSortType,
              minDiscountPercent: editMinDiscountPercent,
              minRating: editMinRating,
              minSales: editMinSales,
              rotationEnabled: editRotationEnabled,
              rotationEmptyThreshold: editRotationEmptyThreshold,
              rotationCooldownMinutes: editRotationCooldownMinutes
            } 
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
      return <span className="status-badge status-badge--paused">Bot Fora</span>;
    }
    if (!group.active) {
      return <span className="status-badge status-badge--paused">Pausado</span>;
    }
    return <span className="status-badge status-badge--connected">Conectado</span>;
  };

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Grupos WhatsApp</h1>
          <p className="text-sm text-slate-400">
            Gerencie os grupos WhatsApp onde o bot enviará ofertas da Shopee automaticamente.
          </p>
        </div>

        {/* Card: Add Group Form */}
        <div className="app-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="app-card__title">Adicionar Grupo</h2>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancelar' : 'Novo Grupo'}
          </button>
        </div>

        {/* Add Group Form */}
        {showAddForm && (
          <form onSubmit={handleAddGroup} className="border-t border-slate-700 pt-4 mt-4 space-y-4">
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
            <div className="flex gap-2">
              <button 
                type="submit" 
                disabled={adding}
                className="btn-primary"
              >
                {adding ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-4 h-4" />}
                Salvar Grupo
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Após salvar, clique em "Entrar" na tabela abaixo para que o bot entre no grupo automaticamente.
            </p>
          </form>
        )}
        </div>

        {/* Card: Groups Table */}
        <div className="app-card" style={{ padding: 0 }}>
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="app-card__title mb-4">Lista de Grupos</h2>
            <div className="group-filters">
              <button
                onClick={() => setFilter('all')}
                className={`group-filter ${filter === 'all' ? 'group-filter--active' : ''}`}
              >
                Todos ({groups.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`group-filter ${filter === 'active' ? 'group-filter--active' : ''}`}
              >
                Ativos ({groups.filter(g => g.active).length})
              </button>
              <button
                onClick={() => setFilter('paused')}
                className={`group-filter ${filter === 'paused' ? 'group-filter--active' : ''}`}
              >
                Pausados ({groups.filter(g => !g.active).length})
              </button>
            </div>
          </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando grupos...</div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Nenhum grupo cadastrado ainda.</p>
            <p className="empty-state__text">
              Clique em "Novo Grupo" para conectar seu primeiro grupo de ofertas.
            </p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5" />
              Novo Grupo
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">
              {filter === 'all' ? 'Nenhum grupo cadastrado.' : `Nenhum grupo ${filter === 'active' ? 'ativo' : 'pausado'}.`}
            </p>
          </div>
        ) : (
          <div className="groups-table-wrapper">
            <table className="w-full">
              <thead className="bg-slate-900 border-b-2 border-slate-700">
                <tr>
                  <th className="text-left px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Status</th>
                  <th className="text-left px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Categoria</th>
                  <th className="text-center px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Keywords</th>
                  <th className="text-left px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Última Mensagem</th>
                  <th className="text-right px-8 py-4 text-xs font-bold text-slate-200 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {filteredGroups.map((group, index) => (
                  <tr key={group.id} className={`hover:bg-slate-800/40 transition-colors ${index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/50'}`}>
                    <td className="px-8 py-4">
                      <div className="text-sm font-medium text-slate-200">{group.name || "Grupo sem nome"}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{group.link}</div>
                    </td>
                    <td className="px-8 py-4">
                      {getStatusBadge(group)}
                    </td>
                    <td className="px-8 py-4">
                      {group.category ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-purple-900/20 text-purple-300 border border-purple-900/30">
                          <Tag className="w-3 h-3" />
                          {group.category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="badge-count">
                        {(group.keywords?.length || 0)}
                      </span>
                      {(group.negativeKeywords?.length || 0) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs rounded-full bg-red-900/20 text-red-300 border border-red-900/30">
                          🚫 {group.negativeKeywords?.length}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-xs text-slate-400">{formatDate(group.lastMessageSent)}</div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!group.chatId && (
                          <button
                            onClick={() => handleJoin(group.id)}
                            disabled={joiningId === group.id}
                            className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-900/30 text-blue-300 border border-blue-900/50 hover:bg-blue-900/50 hover:border-blue-700 transition-all"
                            title="Entrar no grupo"
                          >
                            {joiningId === group.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <LogIn className="w-4 h-4"/>}
                          </button>
                        )}
                        
                        {group.chatId && (
                          <button
                            onClick={() => handleSendTest(group)}
                            disabled={testingId === group.id}
                            className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-900/30 text-purple-300 border border-purple-900/50 hover:bg-purple-900/50 hover:border-purple-700 transition-all"
                            title="Enviar teste"
                          >
                            {testingId === group.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                          </button>
                        )}
                        
                        <button 
                          onClick={() => handleToggle(group.id)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            group.active 
                              ? 'bg-green-900/30 text-green-300 border border-green-900/50 hover:bg-green-900/50 hover:border-green-700' 
                              : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 hover:border-slate-500'
                          }`}
                          title={group.active ? 'Pausar grupo' : 'Ativar grupo'}
                        >
                          {group.active ? '✓' : '⏸'}
                        </button>
                        
                        <button
                          onClick={() => openEditModal(group)}
                          className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all"
                          title="Configurar grupo"
                        >
                          <Settings className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => handleDelete(group.id)}
                          className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-800 text-red-400 border border-slate-700 hover:text-red-300 hover:bg-red-900/30 hover:border-red-700 transition-all"
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
                    className="px-4 py-2 btn-secondary"
                  >
                    Adicionar
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Separe por vírgula. Ex: casa, sala, decoração, banheiro
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  {editKeywords.map((keyword, index) => (
                    <TagChip
                      key={index}
                      label={keyword}
                      onRemove={() => removeKeyword(index)}
                    />
                  ))}
                  {editKeywords.length === 0 && (
                    <span className="text-xs text-slate-500">Nenhuma keyword adicionada. Usa as palavras-chave gerais.</span>
                  )}
                </div>
              </div>

              {/* Filtros de ofertas (opcional) */}
              <div>
                <label className="block text-sm font-medium text-orange-300 mb-2">
                  Filtros de ofertas (opcional)
                </label>
                <p className="text-xs text-slate-400 mb-4">
                  Se você não preencher nada aqui, o bot usa apenas as palavras-chave, como hoje.
                </p>
                
                <div className="space-y-4">
                  {/* Categorias Shopee */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Categorias Shopee
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Nome ou ID da categoria (ex: Roupas Femininas, 100012)"
                        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                        value={categoryIdInput}
                        onChange={(e) => setCategoryIdInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCategoryId();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={addCategoryId}
                        className="px-4 py-2 btn-secondary"
                      >
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {editProductCatIds.map((catId, index) => (
                        <TagChip
                          key={index}
                          label={`${catId}`}
                          onRemove={() => removeCategoryId(index)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Grid for filters */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Ordenação */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        Ordenação
                      </label>
                      <select
                        value={editSortType}
                        onChange={(e) => setEditSortType(parseInt(e.target.value, 10))}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                      >
                        <option value={ShopeeSortType.ITEM_SOLD_DESC}>Mais vendidos (recomendado)</option>
                        <option value={ShopeeSortType.COMMISSION_DESC}>Maior comissão</option>
                        <option value={3}>Maior desconto</option>
                      </select>
                    </div>

                    {/* Desconto mínimo */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        Desconto mínimo (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ex: 25"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                        value={editMinDiscountPercent ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : null;
                          if (val === null || (val >= 0 && val <= 100)) {
                            setEditMinDiscountPercent(val);
                          }
                        }}
                      />
                    </div>

                    {/* Avaliação mínima */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        Avaliação mínima
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        placeholder="Ex: 4.5"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                        value={editMinRating ?? ''}
                        onChange={(e) => setEditMinRating(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>

                    {/* Vendas mínimas */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        Vendas mínimas
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Ex: 100"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white"
                        value={editMinSales ?? ''}
                        onChange={(e) => setEditMinSales(e.target.value ? parseInt(e.target.value, 10) : null)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rotação de Categorias */}
              {editProductCatIds.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-2">
                    Rotação de Categorias
                  </label>
                  <p className="text-xs text-slate-400 mb-4">
                    Quando uma categoria não retorna ofertas, o sistema automaticamente tenta a próxima categoria configurada.
                  </p>
                  
                  {/* Status atual da rotação */}
                  {editingGroup?.rotationState && (
                    <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-md">
                      <p className="text-xs text-slate-300">
                        <span className="font-medium text-green-400">Categoria atual:</span> {editingGroup.rotationState.currentCategoryId} 
                        {' '}|{' '}
                        <span className="font-medium text-green-400">Página:</span> {editingGroup.rotationState.currentPage || 1}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {/* Toggle rotação */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={editRotationEnabled}
                          onChange={(e) => setEditRotationEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                      <span className="text-sm text-slate-300">Rotação automática de categorias</span>
                    </div>
                    
                    {editRotationEnabled && (
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Threshold */}
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-2">
                            Trocar categoria após X tentativas sem resultado
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-white"
                            value={editRotationEmptyThreshold}
                            onChange={(e) => setEditRotationEmptyThreshold(parseInt(e.target.value, 10) || 3)}
                          />
                        </div>
                        
                        {/* Cooldown */}
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-2">
                            Cooldown por categoria (min)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-white"
                            value={editRotationCooldownMinutes}
                            onChange={(e) => setEditRotationCooldownMinutes(parseInt(e.target.value, 10) || 15)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Blacklist */}
              <div>
                <label className="block text-sm font-medium text-red-300 mb-2">
                  Blacklist (Palavras Negativas)
                </label>
                <div className="flex gap-2 mb-3">
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
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Se o título tiver QUALQUER uma dessas palavras, o produto é ignorado.
                </p>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  {editNegative.map((negative, index) => (
                    <TagChip
                      key={index}
                      label={negative}
                      onRemove={() => removeNegative(index)}
                    />
                  ))}
                  {editNegative.length === 0 && (
                    <span className="text-xs text-slate-500">Nenhuma palavra na blacklist.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addQuickBlacklist}
                  className="text-xs flex items-center gap-1.5 bg-transparent text-orange-400 hover:text-orange-300 transition-colors px-0 py-0"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
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
                className="btn-primary"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </main>
  );
};
