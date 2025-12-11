import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup, joinGroup, updateGroup } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, ToggleLeft, ToggleRight, Loader2, LogIn, AlertCircle, Settings, ChevronDown, ChevronUp, Save, XCircle } from 'lucide-react';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupLink, setNewGroupLink] = useState('');
  const [adding, setAdding] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Editing states
  const [editKeywords, setEditKeywords] = useState('');
  const [editNegative, setEditNegative] = useState('');
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

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupLink) return;
    setAdding(true);
    try {
      await addGroup(newGroupLink);
      setNewGroupLink('');
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
          setEditKeywords((group.keywords || []).join(', '));
          setEditNegative((group.negativeKeywords || []).join(', '));
      }
  };

  const handleSaveSettings = async (id: string) => {
      setSavingSettings(true);
      try {
          const k = editKeywords.split(',').map(s => s.trim()).filter(s => s.length > 0);
          const n = editNegative.split(',').map(s => s.trim()).filter(s => s.length > 0);
          
          await updateGroup(id, { keywords: k, negativeKeywords: n });
          
          // Update local state
          setGroups(groups.map(g => g.id === id ? { ...g, keywords: k, negativeKeywords: n } : g));
          setExpandedId(null);
      } catch (e) {
          alert("Erro ao salvar configurações do grupo.");
      } finally {
          setSavingSettings(false);
      }
  };

  return (
    <div className="space-y-6">
      {/* Add Group Card */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-orange-500" />
          Adicionar Grupo
        </h2>
        <form onSubmit={handleAddGroup} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
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
          <button 
            type="submit" 
            disabled={adding}
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 h-[42px] w-full md:w-auto justify-center"
          >
            {adding ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-5 h-5" />}
            Salvar Grupo
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">
            Após salvar, clique em "Entrar" na lista abaixo para que o bot entre no grupo automaticamente.
        </p>
      </div>

      {/* List Groups */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/30 flex justify-between items-center">
            <h3 className="font-semibold text-slate-300">Grupos Cadastrados</h3>
            <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-slate-700">{groups.length} grupos</span>
        </div>
        
        {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando grupos...</div>
        ) : groups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum grupo cadastrado.</div>
        ) : (
            <div className="divide-y divide-slate-800/50">
                {groups.map(group => (
                    <div key={group.id} className="transition-colors hover:bg-slate-800/20">
                        {/* Main Row */}
                        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-medium text-slate-200 truncate">{group.name || "Grupo sem nome"}</h4>
                                    {!group.chatId && (
                                        <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded border border-red-900/50 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Bot fora
                                        </span>
                                    )}
                                    {group.chatId && (
                                         <span className="text-[10px] bg-green-900/30 text-green-300 px-1.5 py-0.5 rounded border border-green-900/50">
                                            Conectado
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{group.link}</p>
                                    {group.keywords && group.keywords.length > 0 && (
                                        <span className="text-[10px] text-blue-300 bg-blue-900/20 px-1 rounded border border-blue-900/30">
                                            {group.keywords.length} keywords
                                        </span>
                                    )}
                                    {group.negativeKeywords && group.negativeKeywords.length > 0 && (
                                        <span className="text-[10px] text-red-300 bg-red-900/20 px-1 rounded border border-red-900/30">
                                            {group.negativeKeywords.length} blacklist
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {!group.chatId && (
                                    <button
                                        onClick={() => handleJoin(group.id)}
                                        disabled={joiningId === group.id}
                                        className="text-xs bg-blue-900/30 text-blue-300 border border-blue-900/50 hover:bg-blue-900/50 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                                    >
                                        {joiningId === group.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <LogIn className="w-3 h-3"/>}
                                        Entrar
                                    </button>
                                )}

                                <button 
                                    onClick={() => handleToggle(group.id)}
                                    className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full transition-colors ${group.active ? 'bg-green-900/30 text-green-300 border border-green-900/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                                >
                                    {group.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                
                                <button
                                    onClick={() => toggleExpand(group)}
                                    className={`p-2 rounded-full transition-colors ${expandedId === group.id ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:bg-slate-800'}`}
                                    title="Configurações do Grupo"
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
                        </div>

                        {/* Expanded Config Section */}
                        {expandedId === group.id && (
                            <div className="bg-slate-950/50 border-t border-slate-800 p-4 animate-in slide-in-from-top-2">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-300 mb-1">
                                            Palavras-chave Específicas (Prioritárias)
                                        </label>
                                        <p className="text-[10px] text-slate-500 mb-2">Se vazio, usa as gerais. Separe por vírgula. Ex: iPhone, Samsung</p>
                                        <textarea 
                                            value={editKeywords}
                                            onChange={(e) => setEditKeywords(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                                            rows={2}
                                            placeholder="Ex: maquiagem, batom, perfume"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-red-300 mb-1">
                                            Blacklist (Palavras Negativas)
                                        </label>
                                        <p className="text-[10px] text-slate-500 mb-2">Se o título conter estas palavras, não envia. Ex: capinha, película</p>
                                        <textarea 
                                            value={editNegative}
                                            onChange={(e) => setEditNegative(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none"
                                            rows={2}
                                            placeholder="Ex: capinha, película, usado"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button 
                                        onClick={() => setExpandedId(null)}
                                        className="text-xs text-slate-400 hover:text-white px-3 py-2"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={() => handleSaveSettings(group.id)}
                                        disabled={savingSettings}
                                        className="text-xs bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 rounded font-medium flex items-center gap-2"
                                    >
                                        {savingSettings ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                                        Salvar Filtros
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};