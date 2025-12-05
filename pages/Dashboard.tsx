import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Toggle } from '../components/UI';
import ConnectWhatsAppModal from '../components/ConnectWhatsAppModal';
import { Check, Trash2, Plus, Zap, ShoppingBag, MessageSquare, Users, Link as LinkIcon, Key, Tag, Smartphone, QrCode, Send, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import type { AppSettings, WhatsAppGroup, GroupCategory } from '../types';
import { db } from '../services/db';
import { useWhatsappStatus } from '../hooks/useWhatsappStatus';

const CATEGORIES: GroupCategory[] = [
  'geral', 'moda', 'beleza', 'casa', 'esportes', 'eletronicos', 'brinquedos', 'pet', 'cozinha'
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Real-time Status Hook (Polling every 5s)
  const { status: whatsappStatus, loading: loadingStatus } = useWhatsappStatus(5000);

  // State
  const [settings, setSettings] = useState<AppSettings>({
    shopeeApiKey: '',
    shopeeApiSecret: '',
    shopeeConnected: false,
    whatsappConnected: false,
    messageTemplate: '',
    automationEnabled: false,
    checkIntervalMinutes: 5, // Default 5 min
  });
  
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [realGroups, setRealGroups] = useState<{ id: string, name: string }[]>([]);
  const [loadingRealGroups, setLoadingRealGroups] = useState(false);
  const [showRealGroups, setShowRealGroups] = useState(false);

  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>('geral');
  
  // Shopee Auth State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // WhatsApp QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);

  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Initial Data Load
  useEffect(() => {
    const userId = db.getCurrentUserId();
    if (!userId) {
      navigate('/login');
      return;
    }
    setCurrentUserId(userId);

    // 1. Carregar Dados Locais
    const gruposData = db.getGrupos(userId);
    setGroups(gruposData.map(g => ({
      id: g.idGrupoInterno,
      link: g.linkGrupo,
      name: g.nomeGrupo || 'Grupo',
      category: g.categoria || 'geral'
    })));

    // Carrega config local de automação
    const automacao = db.getAutomacao(userId);
    if(automacao) {
            setSettings(prev => ({
            ...prev,
            automationEnabled: automacao.estado,
            checkIntervalMinutes: automacao.intervalo
        }));
    }
  }, [navigate]);

  // Sync settings with Real-time Status
  useEffect(() => {
      if (!loadingStatus) {
          setSettings(prev => ({
              ...prev,
              whatsappConnected: whatsappStatus.connected,
              // If server reports automation status, we could sync it here too
          }));
      }
  }, [whatsappStatus, loadingStatus]);

  const handleSaveShopeeCreds = async () => {
    if (!currentUserId) return;
    setIsSavingKey(true);
    
    try {
      db.salvarApiKeyShopee(currentUserId, apiKeyInput, apiSecretInput);
      
      setSettings(prev => ({ 
        ...prev, 
        shopeeApiKey: apiKeyInput, 
        shopeeApiSecret: apiSecretInput, 
        shopeeConnected: !!(apiKeyInput && apiSecretInput) 
      }));
      
      alert("Configuração Shopee salva! (Nota: A VPS usa variáveis de ambiente .env para conexão real)");

    } catch (e) {
      alert("Erro ao salvar configuração.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDisconnectWhatsapp = () => {
    // A desconexão real acontece no celular, aqui apenas limpamos o estado visual
    setSettings(prev => ({ ...prev, whatsappConnected: false }));
    alert("Para desconectar completamente, vá no WhatsApp do celular > Aparelhos Conectados > Desconectar.");
  };

  const handleAutomationChange = async (enabled: boolean, interval: number) => {
    if (!currentUserId) return;
    
    setSettings(prev => ({ ...prev, automationEnabled: enabled, checkIntervalMinutes: interval }));
    db.alternarAutomacao(currentUserId, enabled, interval);
    
    try {
        // Envia para VPS
        const res = await fetch('/api/whatsapp/automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: enabled,
                intervalMinutes: interval
            })
        });

        if (!res.ok) throw new Error("Falha na VPS");

    } catch (e) {
        console.error("Erro automação VPS:", e);
        alert("Erro ao enviar comando para a VPS. Tente novamente.");
        setSettings(prev => ({ ...prev, automationEnabled: !enabled }));
    }
  };

  const handleSaveTemplate = async () => {
    if (!currentUserId) return;
    try {
      db.salvarModeloMensagem(currentUserId, settings.messageTemplate);
      alert('Modelo salvo localmente!');
    } catch (e) {
      alert("Erro ao salvar modelo.");
    }
  };

  const handleFetchRealGroups = async () => {
    setLoadingRealGroups(true);
    setShowRealGroups(true);
    try {
      const res = await fetch('/api/whatsapp/groups');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setRealGroups(data);
      } else {
        alert("Não foi possível buscar os grupos. Verifique se o WhatsApp está conectado.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com a API de grupos.");
    } finally {
      setLoadingRealGroups(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupLink || !currentUserId) return;
    
    if (!newGroupLink.includes('chat.whatsapp.com/')) {
        alert("Link inválido! Use um link do WhatsApp.");
        return;
    }
    
    try {
        const res = await fetch('/api/whatsapp/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                inviteLink: newGroupLink,
                category: newGroupCategory
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao adicionar grupo");
        
        const newGroupView: WhatsAppGroup = {
          id: Date.now().toString(),
          link: newGroupLink,
          name: data.groupName || `Grupo ${groups.length + 1}`,
          category: newGroupCategory
        };
        
        setGroups([...groups, newGroupView]);
        db.adicionarGrupoWhatsApp(currentUserId, newGroupLink, newGroupCategory);
        
        setNewGroupLink('');
        setNewGroupCategory('geral');
        alert(`Entrou no grupo: ${data.groupName}`);
        
    } catch (e: any) {
        alert(`Falha ao entrar no grupo: ${e.message}`);
    }
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

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      alert("Digite um número de telefone.");
      return;
    }

    setSendingTest(true);

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: testPhone, 
          message: settings.messageTemplate || "Mensagem de teste Achady 🚀"
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        alert("✅ Mensagem enviada pela VPS!");
      } else {
        alert("❌ Erro: " + (data.error || "Falha desconhecida"));
      }

    } catch (e) {
      alert("❌ Erro de conexão com a VPS");
    } finally {
      setSendingTest(false);
    }
  };

  if (loadingStatus && !settings.whatsappConnected) return <div className="p-12 text-center text-slate-500 animate-pulse">Carregando status...</div>;

  return (
    <div className="space-y-8 pb-12">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Painel Achady</h1>
          <p className="text-slate-500 mt-1">Gerencie seu robô de ofertas Shopee (VPS Conectada).</p>
        </div>
        
        {settings.automationEnabled ? (
          <div className="px-5 py-2.5 rounded-full bg-emerald-600 text-white shadow-lg flex items-center gap-2 text-sm font-semibold animate-pulse">
            <Zap className="w-4 h-4 fill-white" />
            Robô Ativo
          </div>
        ) : (
          <div className="px-5 py-2.5 rounded-full bg-slate-200 text-slate-500 flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4" />
            Robô Parado
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card WhatsApp */}
        <Card title="Conexão WhatsApp" icon={<Smartphone className="w-5 h-5" />}>
          <div className="space-y-5">
            {/* Status Visual Completo */}
            <div className={`p-4 rounded-xl border flex flex-col gap-3 ${settings.whatsappConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              
              <div className="flex items-center gap-3">
                 {settings.whatsappConnected ? (
                    <div className="p-1.5 bg-emerald-200 rounded-full"><Check className="w-4 h-4 text-emerald-700" /></div>
                 ) : (
                    <div className="p-1.5 bg-red-100 rounded-full"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
                 )}
                 <div className="flex-1">
                   <p className={`text-sm font-bold ${settings.whatsappConnected ? 'text-emerald-800' : 'text-slate-700'}`}>
                       {settings.whatsappConnected ? 'Conectado (Ready)' : 'Desconectado'}
                   </p>
                 </div>
              </div>

              {/* Status Indicators */}
              <div className="flex flex-wrap gap-2 mt-1 pl-10">
                  {/* Shopee Indicator */}
                  <div className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${whatsappStatus.shopeeConfigured ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-amber-200 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${whatsappStatus.shopeeConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {whatsappStatus.shopeeConfigured ? 'Shopee Configurada' : 'Shopee Não Configurada'}
                  </div>
                  
                  {/* Group Indicator */}
                  <div className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${whatsappStatus.groupConfigured ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-amber-200 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${whatsappStatus.groupConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {whatsappStatus.groupConfigured ? 'Grupo Configurado' : 'Grupo Não Configurado'}
                  </div>
              </div>
            </div>

            {settings.whatsappConnected ? (
              <div className="space-y-3">
                 <div className="flex gap-2">
                    <Input 
                      placeholder="5511999999999" 
                      value={testPhone} 
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="text-sm"
                    />
                    <Button onClick={handleSendTestMessage} isLoading={sendingTest} size="sm" variant="secondary">
                       <Send className="w-4 h-4" /> Testar
                    </Button>
                 </div>
                 <Button variant="danger" fullWidth onClick={handleDisconnectWhatsapp}>
                   Desconectar
                 </Button>
              </div>
            ) : (
              <Button onClick={() => setShowQrModal(true)} fullWidth id="btnConnect">
                Conectar WhatsApp
              </Button>
            )}
          </div>
        </Card>

        {/* Card Shopee */}
        <Card title="Configuração Shopee" icon={<ShoppingBag className="w-5 h-5" />}>
          <div className="space-y-5">
            <div className="space-y-4">
              <Input
                label="App ID"
                placeholder="Ex: 1048593"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                icon={<Key className="w-4 h-4" />}
              />
               <Input
                label="App Secret"
                type="password"
                placeholder="Ex: 485038503..."
                value={apiSecretInput}
                onChange={(e) => setApiSecretInput(e.target.value)}
                icon={<Key className="w-4 h-4" />}
              />
              <Input
                label="Palavra-chave Padrão"
                placeholder="Ex: promoção relâmpago"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                icon={<Tag className="w-4 h-4" />}
              />
              <Button 
                onClick={handleSaveShopeeCreds} 
                isLoading={isSavingKey} 
                fullWidth
              >
                Salvar Configuração (Local)
              </Button>
            </div>
          </div>
        </Card>

        {/* Card Automação */}
        <Card title="Configuração do Robô" icon={<Zap className="w-5 h-5" />}>
          <div className="space-y-6">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
               <Toggle 
                checked={settings.automationEnabled} 
                onChange={(val) => handleAutomationChange(val, settings.checkIntervalMinutes)} 
                label="Ativar Robô Automático"
                description="Envia ofertas automaticamente via VPS."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Intervalo (Minutos)</label>
              <div className="grid grid-cols-3 gap-3">
                {[5, 15, 30, 60].map((mins) => (
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
                    {mins}m
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Card Template */}
        <Card title="Modelo de Mensagem" icon={<MessageSquare className="w-5 h-5" />} className="lg:col-span-1">
          <div className="grid grid-cols-1 gap-6 h-full">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {['{{titulo}}', '{{preco}}', '{{precoOriginal}}', '{{desconto}}', '{{link}}'].map(variable => (
                  <button
                    key={variable}
                    onClick={() => insertVariable(variable)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100"
                  >
                    <Plus className="w-3 h-3 mr-1" /> {variable}
                  </button>
                ))}
              </div>
              <textarea
                rows={8}
                className="w-full rounded-xl border-slate-200 bg-slate-50 p-4 font-mono text-sm"
                value={settings.messageTemplate}
                onChange={(e) => setSettings(s => ({ ...s, messageTemplate: e.target.value }))}
              />
              <Button onClick={handleSaveTemplate} variant="secondary" fullWidth>
                <Save className="w-4 h-4 mr-2" /> Salvar Modelo (Local)
              </Button>
            </div>
          </div>
        </Card>

        {/* Card Grupos */}
        <Card 
          title="Grupos de WhatsApp" 
          icon={<Users className="w-5 h-5" />} 
          className="lg:col-span-2"
          action={
            settings.whatsappConnected && (
              <Button size="sm" variant="ghost" onClick={handleFetchRealGroups} isLoading={loadingRealGroups}>
                <RefreshCw className="w-3 h-3 mr-1" /> Sincronizar
              </Button>
            )
          }
        >
          <div className="space-y-6">
            
            {/* Real Groups List (Collapsible) */}
            {showRealGroups && realGroups.length > 0 && (
               <div className="mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-indigo-900">Grupos detectados no WhatsApp ({realGroups.length})</h4>
                    <button className="text-xs text-indigo-500 hover:underline" onClick={() => setShowRealGroups(false)}>Ocultar</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {realGroups.map(g => (
                      <div key={g.id} className="text-xs flex justify-between items-center p-2 bg-white rounded border border-indigo-100">
                        <span className="truncate flex-1 font-medium text-slate-700">{g.name}</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-mono select-all cursor-pointer">{g.id}</span>
                      </div>
                    ))}
                  </div>
               </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                 <Input
                  label="Link de Convite"
                  icon={<LinkIcon className="w-4 h-4" />}
                  placeholder="https://chat.whatsapp.com/..."
                  value={newGroupLink}
                  onChange={(e) => setNewGroupLink(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-slate-600 mb-2 ml-1">Categoria</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value as GroupCategory)}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleAddGroup} disabled={!newGroupLink}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div key={group.id} className="relative bg-white rounded-xl border border-slate-200 p-4 hover:border-achady-purple/50">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <button onClick={() => handleDeleteGroup(group.id)} className="text-slate-300 hover:text-achady-error">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-slate-900 truncate">{group.name}</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 uppercase mt-1">
                    {group.category}
                  </span>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-500">
                  Nenhum grupo cadastrado.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <ConnectWhatsAppModal 
        isOpen={showQrModal} 
        onClose={() => setShowQrModal(false)}
      />

    </div>
  );
};