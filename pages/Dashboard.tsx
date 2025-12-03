
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Toggle } from '../components/UI';
import { Check, Trash2, Plus, Zap, AlertCircle, Save, ShoppingBag, MessageSquare, Users, Link as LinkIcon, ExternalLink, Key } from 'lucide-react';
import type { AppSettings, WhatsAppGroup } from '../types';
import { db } from '../services/db';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State
  const [settings, setSettings] = useState<AppSettings>({
    shopeeApiKey: '',
    shopeeApiSecret: '',
    shopeeConnected: false,
    messageTemplate: '',
    automationEnabled: false,
    checkIntervalMinutes: 15,
  });
  
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [newGroupLink, setNewGroupLink] = useState('');
  
  // Shopee Auth State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    const userId = db.getCurrentUserId();
    if (!userId) {
      navigate('/login');
      return;
    }
    setCurrentUserId(userId);

    const shopeeData = db.getShopeeConfig(userId);
    const modeloData = db.getModelo(userId);
    const gruposData = db.getGrupos(userId);
    const automacaoData = db.getAutomacao(userId);

    setSettings({
      shopeeApiKey: shopeeData?.apiKey || '',
      shopeeApiSecret: shopeeData?.apiSecret || '',
      shopeeConnected: shopeeData?.status === 'conectado',
      messageTemplate: modeloData?.modeloTexto || '',
      automationEnabled: automacaoData?.estado || false,
      checkIntervalMinutes: automacaoData?.intervalo || 15,
    });

    setApiKeyInput(shopeeData?.apiKey || '');
    setApiSecretInput(shopeeData?.apiSecret || '');

    setGroups(gruposData.map(g => ({
      id: g.idGrupoInterno,
      link: g.linkGrupo,
      name: g.nomeGrupo || 'Grupo'
    })));

    setLoading(false);
  }, [navigate]);

  const handleSaveShopeeCreds = () => {
    if (!currentUserId) return;
    setIsSavingKey(true);
    setTimeout(() => {
      db.salvarApiKeyShopee(currentUserId, apiKeyInput, apiSecretInput);
      const isConnected = apiKeyInput.length > 3 && apiSecretInput.length > 3;
      setSettings(prev => ({ 
        ...prev, 
        shopeeApiKey: apiKeyInput, 
        shopeeApiSecret: apiSecretInput,
        shopeeConnected: isConnected 
      }));
      setIsSavingKey(false);
    }, 800);
  };

  const handleAutomationChange = (enabled: boolean, interval: number) => {
    if (!currentUserId) return;
    setSettings(prev => ({ ...prev, automationEnabled: enabled, checkIntervalMinutes: interval }));
    db.alternarAutomacao(currentUserId, enabled, interval);
  };

  const handleSaveTemplate = () => {
    if (!currentUserId) return;
    db.salvarModeloMensagem(currentUserId, settings.messageTemplate);
    alert('Modelo salvo com sucesso!'); // In a real app, use a toast
  };

  const handleAddGroup = () => {
    if (!newGroupLink || !currentUserId) return;
    const novoGrupoDb = db.adicionarGrupoWhatsApp(currentUserId, newGroupLink);
    const newGroupView: WhatsAppGroup = {
      id: novoGrupoDb.idGrupoInterno,
      link: novoGrupoDb.linkGrupo,
      name: novoGrupoDb.nomeGrupo || 'Grupo'
    };
    setGroups([...groups, newGroupView]);
    setNewGroupLink('');
  };

  const handleDeleteGroup = (id: string) => {
    db.deletarGrupo(id);
    setGroups(groups.filter(g => g.id !== id));
  };

  const insertVariable = (variable: string) => {
    setSettings(prev => ({
      ...prev,
      messageTemplate: prev.messageTemplate + ` ${variable}`
    }));
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Carregando painel ACHADY...</div>;

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Painel Achady</h1>
          <p className="text-slate-500 mt-1">Bem-vindo de volta. Monitore suas automações em tempo real.</p>
        </div>
        
        {settings.automationEnabled ? (
          <div className="px-5 py-2.5 rounded-full bg-gradient-to-r from-achady-success to-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4 fill-white animate-pulse" />
            Sistema Operando
          </div>
        ) : (
          <div className="px-5 py-2.5 rounded-full bg-slate-200 text-slate-500 flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4" />
            Sistema Pausado
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Shopee Integration */}
        <Card title="Integração Shopee" icon={<ShoppingBag className="w-5 h-5" />}>
          <div className="space-y-5">
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${settings.shopeeConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              {settings.shopeeConnected ? (
                 <div className="p-1.5 bg-emerald-200 rounded-full"><Check className="w-4 h-4 text-emerald-700" /></div>
              ) : (
                 <div className="p-1.5 bg-amber-200 rounded-full"><AlertCircle className="w-4 h-4 text-amber-700" /></div>
              )}
              <div className="flex-1">
                <p className="text-sm font-bold">{settings.shopeeConnected ? 'Conexão Ativa' : 'Credenciais Pendentes'}</p>
                <p className="text-xs opacity-90">{settings.shopeeConnected ? 'O sistema está autorizado a buscar ofertas.' : 'Insira suas chaves de API para começar.'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="App ID (API Key)"
                type="text"
                placeholder="Ex: 1048593"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                icon={<Key className="w-4 h-4" />}
              />
               <Input
                label="App Secret (Senha da API)"
                type="password"
                placeholder="Ex: 485038503..."
                value={apiSecretInput}
                onChange={(e) => setApiSecretInput(e.target.value)}
                icon={<Key className="w-4 h-4" />}
              />
              <Button 
                onClick={handleSaveShopeeCreds} 
                isLoading={isSavingKey} 
                fullWidth
                disabled={!apiKeyInput || !apiSecretInput}
              >
                {settings.shopeeConnected ? 'Atualizar Credenciais' : 'Conectar Shopee'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Card 2: Automation Controls */}
        <Card title="Controle de Automação" icon={<Zap className="w-5 h-5" />}>
          <div className="space-y-6">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
               <Toggle 
                checked={settings.automationEnabled} 
                onChange={(val) => handleAutomationChange(val, settings.checkIntervalMinutes)} 
                label="Status do Robô"
                description="O sistema buscará e enviará ofertas automaticamente."
              />
            </div>

            <div className={settings.automationEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
              <label className="block text-sm font-medium text-slate-600 mb-2">Frequência de Busca</label>
              <div className="grid grid-cols-3 gap-3">
                {[5, 15, 60].map((mins) => (
                  <div 
                    key={mins}
                    onClick={() => handleAutomationChange(settings.automationEnabled, mins)}
                    className={`
                      cursor-pointer text-center py-3 rounded-xl border text-sm font-medium transition-all
                      ${settings.checkIntervalMinutes === mins 
                        ? 'bg-brand-50 border-achady-purple/30 text-achady-purple ring-1 ring-achady-purple/20' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                    `}
                  >
                    {mins} min
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">Intervalos menores podem consumir mais cota da API.</p>
            </div>
          </div>
        </Card>

        {/* Card 3: Message Template */}
        <Card title="Modelo de Mensagem" icon={<MessageSquare className="w-5 h-5" />} className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-wrap gap-2">
                {['{{titulo}}', '{{preco}}', '{{cupom}}', '{{link}}'].map(variable => (
                  <button
                    key={variable}
                    onClick={() => insertVariable(variable)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-100"
                  >
                    <Plus className="w-3 h-3 mr-1" /> {variable}
                  </button>
                ))}
              </div>
              
              <textarea
                rows={8}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700 focus:ring-2 focus:ring-achady-purple/20 focus:border-achady-purple focus:bg-white transition-all outline-none resize-none"
                placeholder="Escreva aqui como a mensagem deve aparecer..."
                value={settings.messageTemplate}
                onChange={(e) => setSettings(s => ({ ...s, messageTemplate: e.target.value }))}
              />
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-full">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pré-visualização</h4>
                <div className="bg-[#DCF8C6] p-3 rounded-lg rounded-tl-none shadow-sm text-sm text-slate-800 whitespace-pre-line border border-slate-200/50">
                  {settings.messageTemplate || 'Sua mensagem aparecerá assim...'}
                </div>
              </div>
              <Button onClick={handleSaveTemplate} variant="secondary" fullWidth>
                <Save className="w-4 h-4 mr-2" /> Salvar Modelo
              </Button>
            </div>
          </div>
        </Card>

        {/* Card 4: Groups */}
        <Card 
          title="Grupos de Destino" 
          icon={<Users className="w-5 h-5" />} 
          className="lg:col-span-2"
          action={
            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
              {groups.length} grupos ativos
            </div>
          }
        >
          <div className="space-y-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  icon={<LinkIcon className="w-4 h-4" />}
                  placeholder="Cole o link do grupo WhatsApp (https://chat...)"
                  value={newGroupLink}
                  onChange={(e) => setNewGroupLink(e.target.value)}
                />
              </div>
              <Button onClick={handleAddGroup} disabled={!newGroupLink}>
                Adicionar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div key={group.id} className="group relative bg-white rounded-xl border border-slate-200 p-4 hover:border-achady-purple/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 group-hover:bg-brand-50 group-hover:text-achady-purple transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-slate-300 hover:text-achady-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-slate-900 truncate">{group.name}</h4>
                  <a href={group.link} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-achady-purple flex items-center gap-1 mt-1 truncate">
                    {group.link} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
              
              {groups.length === 0 && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-slate-500 text-sm">Nenhum grupo conectado ainda.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
