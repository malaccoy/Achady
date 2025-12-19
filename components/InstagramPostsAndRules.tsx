import React, { useState, useEffect } from 'react';
import { 
  getInstagramStatus, 
  getInstagramPosts, 
  syncInstagramPosts,
  getInstagramRules,
  createInstagramRule,
  updateInstagramRule,
  deleteInstagramRule,
  testInstagramRules
} from '../services/api';
import { InstagramStatus, InstagramPost, InstagramRule, InstagramRulePayload, InstagramMatchType, InstagramRuleTestResponse, InstagramRuleTestMatch } from '../types';
import { 
  Loader2, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  MessageSquare,
  Send,
  Image,
  Video,
  Grid,
  TestTube
} from 'lucide-react';

interface RuleFormData {
  keyword: string;
  matchType: InstagramMatchType;
  mediaId: string | null;
  actionSendDM: boolean;
  actionReplyComment: boolean;
  replyTemplateDM: string;
  replyTemplateComment: string;
  enabled: boolean;
}

const defaultRuleForm: RuleFormData = {
  keyword: '',
  matchType: 'CONTAINS',
  mediaId: null,
  actionSendDM: true,
  actionReplyComment: false,
  replyTemplateDM: 'Olá {username}! Obrigado pelo seu comentário. Entre em contato pelo WhatsApp: {whatsappLink}',
  replyTemplateComment: '',
  enabled: true
};

export const InstagramPostsAndRules: React.FC = () => {
  // State
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [rules, setRules] = useState<InstagramRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // UI state
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<InstagramRule | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormData>(defaultRuleForm);
  const [savingRule, setSavingRule] = useState(false);
  
  // Test state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<InstagramRuleTestResponse | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      // Load status first
      const statusRes = await getInstagramStatus();
      setStatus(statusRes);
      
      if (statusRes.connected) {
        // Load posts and rules
        try {
          const [postsRes, rulesRes] = await Promise.all([
            getInstagramPosts(25),
            getInstagramRules()
          ]);
          setPosts(postsRes.posts);
          setRules(rulesRes);
        } catch (fetchError: any) {
          // Handle specific error codes from backend
          console.error('[Instagram Posts] Fetch error:', fetchError);
          const errorCode = fetchError.error || '';
          
          if (errorCode === 'not_connected' || errorCode === 'token_decrypt_failed') {
            setError('Sua conexão com o Instagram expirou. Por favor, reconecte sua conta.');
          } else if (errorCode === 'oauth_exception') {
            setError('Token de acesso inválido. Reconecte o Instagram.');
          } else if (errorCode === 'insufficient_permissions') {
            setError('Permissões insuficientes. Reconecte o Instagram e conceda todas as permissões.');
          } else if (errorCode === 'rate_limit') {
            setError('Limite de requisições excedido. Aguarde alguns minutos e tente novamente.');
          } else {
            setError(fetchError.message || 'Erro ao carregar posts. Tente novamente.');
          }
        }
      }
    } catch (e: any) {
      console.error('[Instagram Posts] Load error:', e);
      setError(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
      const res = await syncInstagramPosts();
      setSuccessMessage(`${res.synced} posts sincronizados`);
      
      // Reload posts
      const postsRes = await getInstagramPosts(25);
      setPosts(postsRes.posts);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      // Log full error for debugging
      console.error('[Instagram Sync] Error:', e);
      
      // Handle specific error codes from backend
      const errorCode = e.error || '';
      
      if (errorCode === 'not_connected' || errorCode === 'token_decrypt_failed') {
        setError('Sua conexão com o Instagram expirou. Por favor, reconecte sua conta.');
      } else if (errorCode === 'oauth_exception') {
        setError('Token de acesso inválido. Reconecte o Instagram.');
      } else if (errorCode === 'insufficient_permissions') {
        setError('Permissões insuficientes. Reconecte o Instagram e conceda todas as permissões.');
      } else if (errorCode === 'rate_limit') {
        setError('Limite de requisições excedido. Aguarde alguns minutos e tente novamente.');
      } else {
        setError(e.message || 'Erro ao sincronizar posts. Tente novamente.');
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveRule() {
    try {
      setSavingRule(true);
      setError(null);
      
      const payload: InstagramRulePayload = {
        keyword: ruleForm.keyword,
        matchType: ruleForm.matchType,
        mediaId: ruleForm.mediaId || null,
        actionSendDM: ruleForm.actionSendDM,
        actionReplyComment: ruleForm.actionReplyComment,
        replyTemplateDM: ruleForm.replyTemplateDM,
        replyTemplateComment: ruleForm.replyTemplateComment || null,
        enabled: ruleForm.enabled
      };
      
      if (editingRule) {
        await updateInstagramRule(editingRule.id, payload);
        setSuccessMessage('Regra atualizada com sucesso');
      } else {
        await createInstagramRule(payload);
        setSuccessMessage('Regra criada com sucesso');
      }
      
      // Reload rules
      const rulesRes = await getInstagramRules();
      setRules(rulesRes);
      
      // Reset form
      setShowRuleForm(false);
      setEditingRule(null);
      setRuleForm(defaultRuleForm);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar regra');
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;
    
    try {
      setError(null);
      await deleteInstagramRule(id);
      setSuccessMessage('Regra excluída');
      
      // Reload rules
      const rulesRes = await getInstagramRules();
      setRules(rulesRes);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir regra');
    }
  }

  function handleEditRule(rule: InstagramRule) {
    setEditingRule(rule);
    setRuleForm({
      keyword: rule.keyword,
      matchType: rule.matchType,
      mediaId: rule.mediaId || null,
      actionSendDM: rule.actionSendDM,
      actionReplyComment: rule.actionReplyComment,
      replyTemplateDM: rule.replyTemplateDM,
      replyTemplateComment: rule.replyTemplateComment || '',
      enabled: rule.enabled
    });
    setShowRuleForm(true);
  }

  function handleNewRule(postId?: string) {
    // Dev logging to verify click handler runs
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Nova Regra] handleNewRule called', { postId: postId || 'global' });
    }
    setEditingRule(null);
    setRuleForm({
      ...defaultRuleForm,
      mediaId: postId || null
    });
    setShowRuleForm(true);
  }

  async function handleTestRules() {
    if (!testText.trim()) return;
    
    try {
      setTesting(true);
      setError(null);
      const result = await testInstagramRules(testText, selectedPost?.id);
      setTestResult(result);
    } catch (e: any) {
      setError(e.message || 'Erro ao testar regras');
    } finally {
      setTesting(false);
    }
  }

  function getMediaIcon(mediaType: string) {
    switch (mediaType) {
      case 'IMAGE':
        return <Image className="w-4 h-4" />;
      case 'VIDEO':
        return <Video className="w-4 h-4" />;
      case 'CAROUSEL_ALBUM':
        return <Grid className="w-4 h-4" />;
      default:
        return <Image className="w-4 h-4" />;
    }
  }

  function getPostRules(postId: string) {
    return rules.filter(r => r.mediaId === postId || r.mediaId === null);
  }

  if (loading) {
    return (
      <main className="app-main">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-slate-400">Carregando...</span>
        </div>
      </main>
    );
  }

  if (!status?.connected) {
    return (
      <main className="app-main">
        <div className="app-card">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">Instagram não conectado</h2>
              <p className="text-sm text-slate-400 mt-1">
                Conecte sua conta Instagram primeiro na página "Instagram" para acessar Posts & Regras.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Posts & Regras</h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure regras de automação para comentários do Instagram
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowTestModal(true)}
              className="btn-secondary text-sm"
            >
              <TestTube className="w-4 h-4" />
              Testar Regras
            </button>
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="btn-secondary text-sm"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar
            </button>
            <button 
              onClick={() => handleNewRule()}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Regra
            </button>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 bg-green-900/20 text-green-200 border-green-900/30">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-md text-sm border flex items-start gap-3 bg-red-900/20 text-red-200 border-red-900/30">
            <XCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Global Rules */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            Regras Globais (todos os posts)
          </h2>
          
          {rules.filter(r => !r.mediaId).length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma regra global configurada</p>
          ) : (
            <div className="space-y-3">
              {rules.filter(r => !r.mediaId).map(rule => (
                <div 
                  key={rule.id}
                  className={`p-3 rounded-lg border ${rule.enabled ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        rule.matchType === 'CONTAINS' ? 'bg-blue-900/30 text-blue-300' :
                        rule.matchType === 'EQUALS' ? 'bg-green-900/30 text-green-300' :
                        'bg-purple-900/30 text-purple-300'
                      }`}>
                        {rule.matchType}
                      </span>
                      <span className="font-medium text-slate-200">"{rule.keyword}"</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.actionSendDM && (
                        <span className="text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-300">
                          <Send className="w-3 h-3 inline mr-1" />DM
                        </span>
                      )}
                      {rule.actionReplyComment && (
                        <span className="text-xs px-2 py-1 rounded bg-cyan-900/30 text-cyan-300">
                          <MessageSquare className="w-3 h-3 inline mr-1" />Resposta
                        </span>
                      )}
                      <button onClick={() => handleEditRule(rule)} className="p-1 text-slate-400 hover:text-white">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-slate-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Posts Grid */}
        <div className="app-card">
          <h2 className="app-card__title flex items-center gap-2">
            <Image className="w-5 h-5 text-orange-500" />
            Posts Recentes ({posts.length})
          </h2>
          
          {posts.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum post encontrado. Clique em "Sincronizar" para buscar.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {posts.map(post => {
                const postRules = getPostRules(post.id);
                const postSpecificRulesCount = postRules.filter(r => r.mediaId === post.id).length;
                
                return (
                  <div 
                    key={post.id} 
                    className="group relative border border-slate-700 rounded-lg overflow-hidden bg-slate-800/30 hover:border-orange-500/50 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square">
                      {post.mediaUrl ? (
                        <img 
                          src={post.mediaUrl} 
                          alt={post.caption || 'Post'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                          {getMediaIcon(post.mediaType)}
                        </div>
                      )}
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleNewRule(post.id); }}
                          className="btn-primary text-xs px-3 py-1.5"
                          title="Configurar regra para este post"
                        >
                          <Plus className="w-3 h-3" />
                          Regra
                        </button>
                        {post.permalink && (
                          <a 
                            href={post.permalink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-orange-300 hover:text-orange-200 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver no Instagram
                          </a>
                        )}
                      </div>
                      
                      {/* Rules badge */}
                      {postSpecificRulesCount > 0 && (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-orange-500 text-white text-xs font-medium">
                          {postSpecificRulesCount}
                        </div>
                      )}
                      
                      {/* Media type indicator */}
                      <div className="absolute bottom-1 left-1">
                        <span className="text-white/80 bg-black/50 rounded p-0.5">
                          {getMediaIcon(post.mediaType)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-2">
                      <p className="text-xs text-slate-400 truncate">
                        {post.timestamp ? new Date(post.timestamp).toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rule Form Modal */}
        {showRuleForm && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">
                  {editingRule ? 'Editar Regra' : 'Nova Regra'}
                </h3>
                <button onClick={() => { setShowRuleForm(false); setEditingRule(null); }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Keyword */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Palavra-chave *</label>
                  <input
                    type="text"
                    value={ruleForm.keyword}
                    onChange={e => setRuleForm({ ...ruleForm, keyword: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:border-orange-500 focus:outline-none"
                    placeholder="Ex: preço, link, comprar"
                  />
                </div>
                
                {/* Match Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Match</label>
                  <select
                    value={ruleForm.matchType}
                    onChange={e => setRuleForm({ ...ruleForm, matchType: e.target.value as InstagramMatchType })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="CONTAINS">Contém (case-insensitive)</option>
                    <option value="EQUALS">Igual exato (case-insensitive)</option>
                    <option value="REGEX">Regex</option>
                  </select>
                </div>
                
                {/* Actions */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ações</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.actionSendDM}
                        onChange={e => setRuleForm({ ...ruleForm, actionSendDM: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-slate-300">Enviar DM (Private Reply)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.actionReplyComment}
                        onChange={e => setRuleForm({ ...ruleForm, actionReplyComment: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-slate-300">Responder comentário publicamente</span>
                    </label>
                  </div>
                </div>
                
                {/* DM Template */}
                {ruleForm.actionSendDM && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Template da DM *</label>
                    <textarea
                      value={ruleForm.replyTemplateDM}
                      onChange={e => setRuleForm({ ...ruleForm, replyTemplateDM: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:border-orange-500 focus:outline-none"
                      rows={3}
                      placeholder="Use placeholders: {username}, {comment}, {permalink}, {whatsappLink}"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Placeholders: {'{username}'}, {'{comment}'}, {'{permalink}'}, {'{mediaId}'}, {'{igUsername}'}, {'{whatsappLink}'}
                    </p>
                  </div>
                )}
                
                {/* Comment Template */}
                {ruleForm.actionReplyComment && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Template da Resposta</label>
                    <textarea
                      value={ruleForm.replyTemplateComment}
                      onChange={e => setRuleForm({ ...ruleForm, replyTemplateComment: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:border-orange-500 focus:outline-none"
                      rows={2}
                      placeholder="Resposta pública ao comentário"
                    />
                  </div>
                )}
                
                {/* Enabled */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.enabled}
                    onChange={e => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-slate-300">Regra ativa</span>
                </label>
                
                {/* Info */}
                {ruleForm.mediaId && (
                  <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
                    Esta regra será aplicada apenas ao post selecionado (ID: {ruleForm.mediaId.substring(0, 20)}...)
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
                <button 
                  onClick={() => { setShowRuleForm(false); setEditingRule(null); }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveRule}
                  disabled={savingRule || !ruleForm.keyword || (ruleForm.actionSendDM && !ruleForm.replyTemplateDM)}
                  className="btn-primary"
                >
                  {savingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Modal */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-lg">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Testar Regras</h3>
                <button onClick={() => { setShowTestModal(false); setTestResult(null); }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Texto do comentário de teste</label>
                  <textarea
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:border-orange-500 focus:outline-none"
                    rows={3}
                    placeholder="Digite um comentário de exemplo para testar quais regras seriam acionadas"
                  />
                </div>
                
                <button 
                  onClick={handleTestRules}
                  disabled={testing || !testText.trim()}
                  className="btn-primary w-full"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  Executar Teste
                </button>
                
                {testResult && (
                  <div className="mt-4 p-3 bg-slate-900 rounded border border-slate-700">
                    <p className="text-sm text-slate-300 mb-2">
                      {testResult.rulesChecked} regras verificadas, {testResult.matches.length} match(es)
                    </p>
                    
                    {testResult.matches.length === 0 ? (
                      <p className="text-slate-500 text-sm">Nenhuma regra correspondeu ao texto</p>
                    ) : (
                      <div className="space-y-3">
                        {testResult.matches.map((match: InstagramRuleTestMatch, idx: number) => (
                          <div key={idx} className="p-2 bg-slate-800 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-slate-200">Match: "{match.keyword}" ({match.matchType})</span>
                            </div>
                            {match.renderedDM && (
                              <div className="mt-2 text-xs text-slate-400">
                                <strong>DM:</strong> {match.renderedDM}
                              </div>
                            )}
                            {match.renderedComment && (
                              <div className="mt-1 text-xs text-slate-400">
                                <strong>Resposta:</strong> {match.renderedComment}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
