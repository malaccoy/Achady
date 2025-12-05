import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Toggle } from '../components/UI';
import ConnectWhatsAppModal from '../components/ConnectWhatsAppModal';
import { Check, Trash2, Plus, Zap, AlertCircle, Save, ShoppingBag, MessageSquare, Users, Link as LinkIcon, Key, Tag, Smartphone, QrCode, Send } from 'lucide-react';
import type { AppSettings, WhatsAppGroup, GroupCategory } from '../types';
import { db } from '../services/db';

const CATEGORIES: GroupCategory[] = [
  'geral', 'moda', 'beleza', 'casa', 'esportes', 'eletronicos', 'brinquedos', 'pet', 'cozinha'
];

// ✅ USER ID FIXO PARA O MVP
const FIXED_USER_ID = "1";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // State
  const [settings, setSettings] = useState<AppSettings>({
    shopeeApiKey: '',
    shopeeApiSecret: '',
    shopeeConnected: false,
    whatsappConnected: false,
    messageTemplate: '',
    automationEnabled: false,
    checkIntervalMinutes: 30,
  });
  
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>('geral');
  
  // Shopee Auth State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // WhatsApp QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);

  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

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
      whatsappConnected: automacaoData?.whatsappStatus === 'CONNECTED',
      messageTemplate: modeloData?.modeloTexto || '',
      automationEnabled: automacaoData?.estado || false,
      checkIntervalMinutes: automacaoData?.intervalo || 30,
    });

    setApiKeyInput(shopeeData?.apiKey || '');
    setApiSecretInput(shopeeData?.apiSecret || '');

    setGroups(gruposData.map(g => ({
      id: g.idGrupoInterno,
      link: g.linkGrupo,
      name: g.nomeGrupo || 'Grupo',
      category: g.categoria || 'geral'
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
      
      // Update config on new server (using correct field names appId/appSecret)
      fetch(`/api/config/${FIXED_USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            appId: apiKeyInput,
            appSecret: apiSecretInput,
            keyword: 'ofertas' // default keyword
        })
      }).catch(console.error);
      
    }, 800);
  };

  const handleDisconnectWhatsapp = () => {
    if (!currentUserId) return;
    db.setWhatsappStatus(currentUserId, 'DISCONNECTED');
    setSettings(prev => ({ ...prev, whatsappConnected: false }));
  };

  const handleAutomationChange = async (enabled: boolean, interval: number) => {
    if (!currentUserId) return;
    setSettings(prev => ({ ...prev, automationEnabled: enabled, checkIntervalMinutes: interval }));
    db.alternarAutomacao(currentUserId, enabled, interval);
    
    // Call Server (New endpoint merges activation state and interval)
    try {
        await fetch(`/api/config/${FIXED_USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                intervalMinutes: interval,
                isActive: enabled
            })
        });
    } catch (e) {
        console.error("Erro ao comunicar com servidor de automação:", e);
        alert("Erro ao conectar com o robô.");
    }
  };

  const handleSaveTemplate = async () => {
    if (!currentUserId) return;
    db.salvarModeloMensagem(currentUserId, settings.messageTemplate);
    
    // Convert generic {{var}} to backend specific {var} if needed or just send as is
    // The new backend uses handlebars style {{var}} which matches UI
    await fetch(`/api/config/${FIXED_USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageTemplate: settings.messageTemplate })
    });
    
    alert('Modelo salvo e atualizado no robô!');
  };

  const handleAddGroup = async () => {
    if (!newGroupLink || !currentUserId) return;
    
    // ✅ VALIDAÇÃO DO LINK (UI)
    const linkRegex = /chat\.whatsapp\.com\/[A-Za-z0-9]{5,}/;
    if (!linkRegex.test(newGroupLink)) {
        alert("Link inválido! Use um link de convite do WhatsApp válido (ex: https://chat.whatsapp.com/...).");
        return;
    }
    
    // Join Group on Server
    try {
        const res = await fetch(`/api/join/${FIXED_USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                invite: newGroupLink,
                name: `Grupo ${groups.length + 1}`,
                category: newGroupCategory
            })
        });
        const data = await res.json();
        
        if (!res.ok) {
           throw new Error(data.error || "Erro ao adicionar grupo no servidor");
        }
        
    } catch (e: any) {
        console.error("Aviso: Falha ao entrar automaticamente no grupo via servidor", e);
        alert(`Não foi possível adicionar o grupo: ${e.message}`);
        return; 
    }

    const novoGrupoDb = db.adicionarGrupoWhatsApp(currentUserId, newGroupLink, newGroupCategory);
    
    const newGroupView: WhatsAppGroup = {
      id: novoGrupoDb.idGrupoInterno,
      link: novoGrupoDb.linkGrupo,
      name: novoGrupoDb.nomeGrupo || 'Grupo',
      category: novoGrupoDb.categoria
    };
    
    setGroups([...groups, newGroupView]);
    setNewGroupLink('');
    setNewGroupCategory('geral');
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

  // ✅ TESTE DE ENVIO (USANDO NOVO BACKEND LOCAL)
  const handleSendTestMessage = async () => {
    if (!testPhone) {
      alert("Digite um número de telefone para teste (ex: 5511999999999)");
      return;
    }

    setSendingTest(true);

    try {
      // Proxied to localhost:3000/send/1 (added to server.js manually)
      const response = await fetch(`/api/send/${FIXED_USER_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: testPhone, // Backend supports 'number' or 'groupId'
          message: settings.messageTemplate || "Mensagem de teste Achady 🚀"
        })
      });

      const data = await response.json();
      
      if (response.ok && data.ok) {
        alert("✅ Mensagem enviada com sucesso!");
      } else {
        alert("❌ Erro: " + (data.error || "Falha desconhecida"));
      }

    } catch (e) {
      alert("❌ Erro de conexão com o servidor local");
      console.error(e);
    } finally {
      setSendingTest(false);
    }
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
        
        {/* Card 1: WhatsApp Integration */}
        <Card title="Conexão WhatsApp" icon={<Smartphone className="w-5 h-5" />}>
          <div className="space-y-5">
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${settings.whatsappConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {settings.whatsappConnected ? (
                 <div className="p-1.5 bg-emerald-200 rounded-full"><Check className="w-4 h-4 text-emerald-700" /></div>
              ) : (
                 <div className="p-1.5 bg-slate-200 rounded-full"><QrCode className="w-4 h-4 text-slate-600" /></div>
              )}
              <div className="flex-1">
                <p className="text-sm font-bold">{settings.whatsappConnected ? 'Sessão Ativa' : 'Desconectado'}</p>
                <p className="text-xs opacity-90">{settings.whatsappConnected ? 'Seu WhatsApp está pronto para enviar ofertas.' : 'Escaneie o QR Code para conectar seu número.'}</p>
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
                       <Send className="w-4 h-4" />
                    </Button>
                 </div>
                 <Button variant="danger" fullWidth onClick={handleDisconnectWhatsapp}>
                   Desconectar Sessão
                 </Button>
              </div>
            ) : (
              <Button onClick={() => setShowQrModal(true)} fullWidth id="btnConnect">
                Conectar WhatsApp
              </Button>
            )}
          </div>
        </Card>

        {/* Card 2: Shopee Integration */}
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
              <p className="text-[10px] text-slate-400 text-center">Nota: Atualize também o arquivo shopee.js se necessário.</p>
            </div>
          </div>
        </Card>

        {/* Card 3: Automation Controls */}
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
                {[15, 30, 60].map((mins) => (
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

        {/* Card 4: Message Template */}
        <Card title="Modelo de Mensagem" icon={<MessageSquare className="w-5 h-5" />} className="lg:col-span-1">
          <div className="grid grid-cols-1 gap-6 h-full">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {['{{titulo}}', '{{preco}}', '{{link}}'].map(variable => (
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
              <Button onClick={handleSaveTemplate} variant="secondary" fullWidth>
                <Save className="w-4 h-4 mr-2" /> Salvar Modelo e Atualizar Robô
              </Button>
            </div>
          </div>
        </Card>

        {/* Card 5: Groups */}
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
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                 <Input
                  label="Link do Grupo WhatsApp"
                  icon={<LinkIcon className="w-4 h-4" />}
                  placeholder="https://chat.whatsapp.com/..."
                  value={newGroupLink}
                  onChange={(e) => setNewGroupLink(e.target.value)}
                />
              </div>
              
              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-slate-600 mb-2 ml-1">Categoria (Nicho)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Tag className="w-4 h-4" />
                  </div>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 pl-10 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-achady-purple/20 focus:border-achady-purple transition-all duration-200 appearance-none"
                    value={newGroupCategory}
                    onChange={(e) => setNewGroupCategory(e.target.value as GroupCategory)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button onClick={handleAddGroup} disabled={!newGroupLink}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
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
                  
                  <div className="mt-1 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 uppercase tracking-wide">
                      {group.category || 'Geral'}
                    </span>
                  </div>

                  <a href={group.link} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-achady-purple flex items-center gap-1 mt-2 truncate border-t border-slate-50 pt-2">
                    <LinkIcon className="w-3 h-3" /> {group.link.replace('https://', '')}
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

      {/* WhatsApp Connect Modal */}
      <ConnectWhatsAppModal 
        isOpen={showQrModal} 
        onClose={() => setShowQrModal(false)}
      />

    </div>
  );
};