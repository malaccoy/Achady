import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup, joinGroup } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, ToggleLeft, ToggleRight, Loader2, LogIn, AlertCircle } from 'lucide-react';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
      // Logic: Add group locally first, then try to join
      await addGroup(newGroupLink);
      setNewGroupLink('');
      setNewGroupName('');
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

  return (
    <div className="space-y-6">
      {/* Add Group Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Adicionar Grupo
        </h2>
        <form onSubmit={handleAddGroup} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Link de Convite do Grupo</label>
            <div className="relative">
                <LinkIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    value={newGroupLink}
                    onChange={(e) => setNewGroupLink(e.target.value)}
                    required
                />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={adding}
            className="bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 h-[42px] w-full md:w-auto justify-center"
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
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Grupos Cadastrados</h3>
            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{groups.length} grupos</span>
        </div>
        
        {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando grupos...</div>
        ) : groups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum grupo cadastrado.</div>
        ) : (
            <div className="divide-y divide-slate-100">
                {groups.map(group => (
                    <div key={group.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-slate-900 truncate">{group.name || "Grupo sem nome"}</h4>
                                {!group.chatId && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Bot fora do grupo
                                    </span>
                                )}
                                {group.chatId && (
                                     <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded border border-green-200">
                                        Conectado
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-1">{group.link}</p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {!group.chatId && (
                                <button
                                    onClick={() => handleJoin(group.id)}
                                    disabled={joiningId === group.id}
                                    className="text-xs bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors"
                                >
                                    {joiningId === group.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <LogIn className="w-3 h-3"/>}
                                    Entrar
                                </button>
                            )}

                            <button 
                                onClick={() => handleToggle(group.id)}
                                className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full transition-colors ${group.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                {group.active ? (
                                    <>Ativo <ToggleRight className="w-5 h-5" /></>
                                ) : (
                                    <>Inativo <ToggleLeft className="w-5 h-5" /></>
                                )}
                            </button>
                            <button 
                                onClick={() => handleDelete(group.id)}
                                className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                                title="Excluir grupo"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
