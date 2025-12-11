import React, { useState, useEffect, useRef } from 'react';
import { 
  getTemplates, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate,
  setActiveTemplate,
  getSignature,
  saveSignature,
  sendTestOffer 
} from '../services/api';
import { 
  MOCK_PREVIEW_DATA, 
  MOCK_PREVIEW_DATA_NO_DISCOUNT,
  DEFAULT_TEMPLATE,
  DEFAULT_SIGNATURE,
  EMOJI_LIBRARY,
  TEXT_SNIPPETS,
  TEMPLATE_PRESETS
} from '../constants';
import { MessageTemplate } from '../types';
import { 
  MessageSquare, 
  Save, 
  Send, 
  Loader2, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  Copy,
  Trash2,
  Sun,
  Moon,
  Smile,
  Type
} from 'lucide-react';

export const TemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState('');
  const [signature, setSignatureText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [showDiscountPreview, setShowDiscountPreview] = useState(true);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const signatureRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTemplates();
    loadSignature();
  }, []);

  const loadTemplates = async () => {
    try {
      const loadedTemplates = await getTemplates();
      
      if (loadedTemplates.length === 0) {
        // Create default template if none exist
        const defaultTemplate = await createTemplate('Padrão', DEFAULT_TEMPLATE);
        setTemplates([defaultTemplate]);
        setActiveTemplateId(defaultTemplate.id!);
        setCurrentTemplate(defaultTemplate.content);
        await setActiveTemplate(defaultTemplate.id!);
      } else {
        setTemplates(loadedTemplates);
        const activeTemplate = loadedTemplates.find(t => t.isDefault) || loadedTemplates[0];
        setActiveTemplateId(activeTemplate.id!);
        setCurrentTemplate(activeTemplate.content);
      }
    } catch (e) {
      console.error('Error loading templates:', e);
      setCurrentTemplate(DEFAULT_TEMPLATE);
    }
  };

  const loadSignature = async () => {
    try {
      const data = await getSignature();
      setSignatureText(data.signature || DEFAULT_SIGNATURE);
    } catch (e) {
      setSignatureText(DEFAULT_SIGNATURE);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setActiveTemplateId(templateId);
      setCurrentTemplate(template.content);
      try {
        await setActiveTemplate(templateId);
      } catch (e: any) {
        console.error('Error setting active template:', e);
      }
    }
  };

  const handleSaveCurrentTemplate = async () => {
    if (!activeTemplateId) return;
    
    setLoading(true);
    setStatusMsg(null);
    try {
      await updateTemplate(activeTemplateId, { content: currentTemplate });
      
      // Update local state
      setTemplates(templates.map(t => 
        t.id === activeTemplateId ? { ...t, content: currentTemplate } : t
      ));
      
      setStatusMsg({ type: 'success', text: 'Modelo salvo com sucesso!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao salvar modelo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await saveSignature(signature);
      setStatusMsg({ type: 'success', text: 'Assinatura salva com sucesso!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao salvar assinatura.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setStatusMsg({ type: 'error', text: 'Digite um nome para o modelo.' });
      return;
    }
    
    try {
      const newTemplate = await createTemplate(newTemplateName, DEFAULT_TEMPLATE);
      setTemplates([...templates, newTemplate]);
      setActiveTemplateId(newTemplate.id!);
      setCurrentTemplate(newTemplate.content);
      setNewTemplateName('');
      setShowNewTemplateModal(false);
      setStatusMsg({ type: 'success', text: 'Novo modelo criado!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao criar modelo.' });
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!activeTemplateId) return;
    
    const activeTemplate = templates.find(t => t.id === activeTemplateId);
    if (!activeTemplate) return;
    
    const newName = `${activeTemplate.name} (Cópia)`;
    try {
      const duplicatedTemplate = await createTemplate(newName, currentTemplate);
      setTemplates([...templates, duplicatedTemplate]);
      setActiveTemplateId(duplicatedTemplate.id!);
      setStatusMsg({ type: 'success', text: 'Modelo duplicado!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao duplicar modelo.' });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplateId || templates.length <= 1) {
      setStatusMsg({ type: 'error', text: 'Você precisa ter pelo menos um modelo.' });
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return;
    
    try {
      await deleteTemplate(activeTemplateId);
      const remainingTemplates = templates.filter(t => t.id !== activeTemplateId);
      setTemplates(remainingTemplates);
      setActiveTemplateId(remainingTemplates[0].id!);
      setCurrentTemplate(remainingTemplates[0].content);
      setStatusMsg({ type: 'success', text: 'Modelo excluído!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao excluir modelo.' });
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setStatusMsg(null);
    try {
      await sendTestOffer();
      setStatusMsg({ type: 'success', text: 'Oferta de teste enviada para os grupos ativos.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch(e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao enviar teste.' });
    } finally {
      setSendingTest(false);
    }
  };

  const insertTextAtCursor = (text: string, targetRef: React.RefObject<HTMLTextAreaElement>) => {
    const textarea = targetRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = targetRef === textareaRef ? currentTemplate : signature;
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

    if (targetRef === textareaRef) {
      setCurrentTemplate(newValue);
    } else {
      setSignatureText(newValue);
    }

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  };

  // Real-time preview generator with conditional discount handling
  const getPreviewText = () => {
    const data = showDiscountPreview ? MOCK_PREVIEW_DATA : MOCK_PREVIEW_DATA_NO_DISCOUNT;
    let text = currentTemplate;

    // Handle conditional discount display
    // If desconto is empty, remove lines containing discount patterns
    if (!data.desconto || data.desconto.trim() === '') {
      // Remove patterns like "({{desconto}} OFF)" or similar
      text = text.replace(/\s*\([^)]*{{\s*desconto\s*}}[^)]*\)/gi, '');
      // Remove lines that only contain {{desconto}}
      text = text.replace(/.*{{\s*desconto\s*}}.*/gi, '');
    }

    // Replace all variables case-insensitive
    text = text.replace(/{{\s*titulo\s*}}/gi, data.titulo);
    text = text.replace(/{{\s*preco\s*}}/gi, data.preco);
    text = text.replace(/{{\s*precoOriginal\s*}}/gi, data.precoOriginal);
    text = text.replace(/{{\s*desconto\s*}}/gi, data.desconto);
    text = text.replace(/{{\s*link\s*}}/gi, data.link);

    // Clean up empty lines from conditional removal
    text = text.replace(/\n{3,}/g, '\n\n');

    // Add signature if present
    if (signature.trim()) {
      text = text + '\n\n' + signature;
    }

    return text;
  };

  const previewText = getPreviewText();
  const activeTemplate = templates.find(t => t.id === activeTemplateId);

  // Preview theme styles
  const previewBgColor = previewTheme === 'dark' ? '#0b141a' : '#efeae2';
  const previewBubbleColor = previewTheme === 'dark' ? '#202c33' : '#ffffff';
  const previewTextColor = previewTheme === 'dark' ? '#e9edef' : '#111b21';
  const previewTimeColor = previewTheme === 'dark' ? '#8696a0' : '#667781';
  const previewInputBg = previewTheme === 'dark' ? '#2a3942' : '#ffffff';
  const previewInputBarBg = previewTheme === 'dark' ? '#202c33' : '#f0f2f5';

  return (
    <div className="grid lg:grid-cols-[1fr,350px,1fr] gap-6 h-full">
      {/* Editor Column */}
      <div className="card p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-orange-500" />
            Modelo de Mensagem
          </h2>
        </div>

        {/* Template Selector */}
        <div className="mb-4 space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Selecionar modelo:
          </label>
          <div className="flex gap-2">
            <select
              value={activeTemplateId || ''}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-md px-3 py-2 text-slate-200 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewTemplateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
              title="Novo modelo"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleDuplicateTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
              title="Duplicar modelo atual"
            >
              <Copy className="w-4 h-4" />
            </button>
            {templates.length > 1 && (
              <button
                onClick={handleDeleteTemplate}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1"
                title="Excluir modelo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* New Template Modal */}
        {showNewTemplateModal && (
          <div className="mb-4 p-4 bg-slate-800 border border-slate-700 rounded-md">
            <h3 className="text-sm font-medium text-slate-200 mb-2">Criar novo modelo</h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Nome do modelo"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-md px-3 py-2 text-slate-200 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none mb-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateTemplate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm"
              >
                Criar
              </button>
              <button
                onClick={() => {
                  setShowNewTemplateModal(false);
                  setNewTemplateName('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        
        <div className="mb-3 text-xs text-slate-400 bg-slate-900/30 p-3 rounded border border-slate-700/50 flex gap-2 items-start">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
          <div>
            Variáveis disponíveis: 
            <div className="mt-1 flex flex-wrap gap-2 font-mono">
              <span className="text-orange-400 bg-orange-900/10 px-1 rounded">{`{{titulo}}`}</span>
              <span className="text-orange-400 bg-orange-900/10 px-1 rounded">{`{{preco}}`}</span>
              <span className="text-orange-400 bg-orange-900/10 px-1 rounded">{`{{precoOriginal}}`}</span>
              <span className="text-orange-400 bg-orange-900/10 px-1 rounded">{`{{desconto}}`}</span>
              <span className="text-orange-400 bg-orange-900/10 px-1 rounded">{`{{link}}`}</span>
            </div>
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-300 mb-2">
          Conteúdo do Modelo:
        </label>
        <textarea
          ref={textareaRef}
          className="flex-1 w-full p-4 bg-slate-900/50 border border-slate-700 rounded-md font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-200 leading-relaxed"
          value={currentTemplate}
          onChange={(e) => setCurrentTemplate(e.target.value)}
          placeholder="Digite sua mensagem aqui..."
          style={{ minHeight: '200px' }}
        />

        <label className="block text-sm font-medium text-slate-300 mb-2 mt-4">
          Assinatura / Rodapé:
        </label>
        <textarea
          ref={signatureRef}
          className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-md font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-200 leading-relaxed"
          value={signature}
          onChange={(e) => setSignatureText(e.target.value)}
          placeholder="Assinatura que será adicionada ao final de todas as mensagens..."
          rows={2}
        />

        {statusMsg && (
          <div className={`mt-4 p-3 rounded text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1
            ${statusMsg.type === 'success' ? 'bg-green-900/20 text-green-300 border border-green-900/30' : 'bg-red-900/20 text-red-300 border border-red-900/30'}`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
            {statusMsg.text}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button 
            onClick={handleSaveCurrentTemplate}
            disabled={loading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
            Salvar Modelo
          </button>
          <button 
            onClick={handleSaveSignature}
            disabled={loading}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
            Salvar Assinatura
          </button>
          <button 
            onClick={handleSendTest}
            disabled={sendingTest}
            className="flex-1 bg-slate-100 hover:bg-white text-slate-800 border border-slate-300 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingTest ? <Loader2 className="animate-spin w-4 h-4 text-green-700"/> : <Send className="w-4 h-4 text-green-700" />}
            Enviar Teste
          </button>
        </div>
      </div>

      {/* Emoji & Snippets Sidebar */}
      <div className="card p-4 flex flex-col h-full overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
            <Smile className="w-4 h-4 text-orange-500" />
            Emojis
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {EMOJI_LIBRARY.map((item, idx) => (
              <button
                key={idx}
                onClick={() => insertTextAtCursor(item.emoji, textareaRef)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-2xl transition-colors"
                title={item.label}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
            <Type className="w-4 h-4 text-orange-500" />
            Snippets
          </h3>
          <div className="space-y-2">
            {TEXT_SNIPPETS.map((snippet, idx) => (
              <button
                key={idx}
                onClick={() => insertTextAtCursor(snippet.text, textareaRef)}
                className="w-full p-2 bg-slate-800 hover:bg-slate-700 rounded text-left text-xs text-slate-200 transition-colors"
              >
                {snippet.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-bold text-slate-100 mb-3">Modelos Predefinidos</h3>
          <div className="space-y-2">
            {TEMPLATE_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentTemplate(preset.content)}
                className="w-full p-2 bg-slate-800 hover:bg-slate-700 rounded text-left text-xs text-slate-200 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Column */}
      <div className="card p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">Prévia (WhatsApp)</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
              title={`Alternar para tema ${previewTheme === 'dark' ? 'claro' : 'escuro'}`}
            >
              {previewTheme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showDiscountPreview}
              onChange={(e) => setShowDiscountPreview(e.target.checked)}
              className="rounded"
            />
            Mostrar prévia com desconto
          </label>
        </div>

        <div 
          className="rounded-lg flex-1 flex flex-col relative overflow-hidden border border-slate-700/50"
          style={{ backgroundColor: previewBgColor }}
        >
          {/* WhatsApp Background Pattern (only for dark theme) */}
          {previewTheme === 'dark' && (
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none" 
              style={{ 
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundSize: '400px',
                backgroundRepeat: 'repeat'
              }}
            />
          )}
          
          <div className="relative z-10 flex-1 p-4 overflow-y-auto">
            <div 
              className="p-2.5 rounded-tr-lg rounded-tl-none rounded-br-lg rounded-bl-lg shadow-sm max-w-[90%] self-start text-left inline-block"
              style={{ backgroundColor: previewBubbleColor }}
            >
              <p 
                className="whitespace-pre-wrap text-[14.2px] break-words leading-snug font-sans"
                style={{ color: previewTextColor }}
              >
                {previewText}
              </p>
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[11px]" style={{ color: previewTimeColor }}>
                  12:42
                </span>
              </div>
            </div>
          </div>
          
          {/* Fake input bar */}
          <div 
            className="p-3 flex items-center gap-4 relative z-20"
            style={{ backgroundColor: previewInputBarBg }}
          >
            <div className="w-6 h-6 rounded-full border-2 opacity-50" style={{ borderColor: previewTimeColor }}></div>
            <div className="flex-1 h-9 rounded-lg" style={{ backgroundColor: previewInputBg, border: previewTheme === 'light' ? '1px solid #d1d7db' : 'none' }}></div>
            <div className="w-6 h-6 rounded-full bg-[#00a884]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
