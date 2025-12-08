import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { getGroups, addGroup, toggleGroup, deleteGroup } from '../services/api';
import { Plus, Trash2, Link as LinkIcon, Users, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupLink, setNewGroupLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const data = await getGroups();
    // Simulate data if empty for UI dev
    if (data.length === 0) {
        setGroups([
            { id: '1', name: 'Promoções Tech', link: 'https://chat.whatsapp.com/ExAmPlE', active: true },
            { id: '2', name: 'Ofertas do Dia', link: 'https://chat.whatsapp.com/TeStInG', active: false }
        ]);
    } else {
        setGroups(data);
    }
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
    setGroups(updatedGroups); // Optimistic update
    try {
        await toggleGroup(id);
    } catch (e) {
        await fetchGroups(); // Revert on error
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

  return (
    <div className="space-y-6">
      {/* Add Group Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Adicionar Grupo
        </h2>
        <form onSubmit={handleAddGroup} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Link do Grupo WhatsApp</label>
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
            className="bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 h-[42px]"
          >
            {adding ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-5 h-5" />}
            Adicionar
          </button>
        </form>
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
                    <div key={group.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                            <h4 className="text-sm font-medium text-slate-900 truncate">{group.name || "Grupo sem nome"}</h4>
                            <p className="text-xs text-slate-500 truncate">{group.link}</p>
                        </div>
                        <div className="flex items-center gap-4">
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