import React, { useState, useEffect, useRef } from 'react';
import { getTemplate, saveTemplate, sendTestOffer } from '../services/api';
import { MOCK_PREVIEW_DATA, DEFAULT_TEMPLATE } from '../constants';
import { MessageSquare, Save, Send, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

const variables = ["{{titulo}}", "{{preco}}", "{{precoOriginal}}", "{{desconto}}", "{{link}}"];

const variableHints: Record<string, string> = {
  "{{titulo}}": "Ex.: Kit 10 Organizadores Acrílico...",
  "{{preco}}": "Ex.: R$ 50,19",
  "{{precoOriginal}}": "Ex.: R$ 66,64",
  "{{desconto}}": "Ex.: 25% OFF",
  "{{link}}": "Ex.: https://s.shopee.com.br/exemplo"
};

interface VariableChipsProps {
  onInsert: (variable: string) => void;
}

const VariableChips: React.FC<VariableChipsProps> = ({ onInsert }) => {
  return (
    <div className="variable-chips">
      {variables.map((variable) => (
        <button
          key={variable}
          type="button"
          className="variable-chip"
          onClick={() => onInsert(variable)}
          title={variableHints[variable]}
        >
          {variable}
        </button>
      ))}
    </div>
  );
};

export const TemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getTemplate();
        // If API returns empty or null, use default
        if (data && data.template && data.template.trim().length > 0) {
          setTemplate(data.template);
        } else {
          setTemplate(DEFAULT_TEMPLATE);
        }
      } catch (e) {
        // On error, fallback to default
        setTemplate(DEFAULT_TEMPLATE);
      }
    };
    init();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await saveTemplate(template);
      setStatusMsg({ type: 'success', text: 'Modelo salvo com sucesso!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao salvar modelo.' });
    } finally {
      setLoading(false);
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

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = template;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    setTemplate(newText);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleResetTemplate = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setStatusMsg({ type: 'success', text: 'Modelo restaurado para o padrão!' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Real-time preview generator
  const getPreviewText = () => {
    let text = template;
    // Replace all occurrences case-insensitive
    text = text.replace(/{{\s*titulo\s*}}/gi, MOCK_PREVIEW_DATA.titulo);
    text = text.replace(/{{\s*preco\s*}}/gi, MOCK_PREVIEW_DATA.preco);
    text = text.replace(/{{\s*precoOriginal\s*}}/gi, MOCK_PREVIEW_DATA.precoOriginal);
    text = text.replace(/{{\s*desconto\s*}}/gi, MOCK_PREVIEW_DATA.desconto);
    text = text.replace(/{{\s*link\s*}}/gi, MOCK_PREVIEW_DATA.link);
    return text;
  };

  const previewText = getPreviewText();

  return (
    <main className="app-main">
      <div className="space-y-6">
        {/* Page Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Modelo de Mensagem</h1>
          <p className="text-sm text-slate-400">
            Personalize a mensagem que será enviada aos grupos com as ofertas da Shopee.
          </p>
        </div>

        {/* Template Layout: Side-by-side Editor and Preview */}
        <div className="template-layout">
          {/* Editor Section */}
          <section className="template-layout__editor">
            <div className="app-card flex flex-col">
              <h2 className="app-card__title">Editor de Modelo</h2>
            
            {/* Variable Chips */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Variáveis disponíveis:</p>
              <VariableChips onInsert={handleInsertVariable} />
            </div>

            {/* Template Editor Textarea */}
            <textarea
              ref={textareaRef}
              className="template-editor"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
            />

            {/* Reset Button */}
            <button
              type="button"
              className="link-button"
              onClick={handleResetTemplate}
            >
              Restaurar modelo padrão
            </button>

            {/* Status Message */}
            {statusMsg && (
              <div className={`mt-4 p-3 rounded text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1
                ${statusMsg.type === 'success' ? 'bg-green-900/20 text-green-300 border border-green-900/30' : 'bg-red-900/20 text-red-300 border border-red-900/30'}`}>
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                {statusMsg.text}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button 
                onClick={handleSave}
                disabled={loading}
                className="flex-1 btn-secondary"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
                Salvar Modelo
              </button>
              <button 
                onClick={handleSendTest}
                disabled={sendingTest}
                className="flex-1 btn-primary"
              >
                {sendingTest ? <Loader2 className="animate-spin w-4 h-4"/> : <Send className="w-4 h-4" />}
                Enviar Teste Agora
              </button>
            </div>
          </div>
        </section>

        {/* Preview Section */}
        <section className="template-layout__preview">
          <div className="app-card flex flex-col">
            <h2 className="app-card__title">Prévia (WhatsApp)</h2>
            <div className="bg-[#0b141a] p-0 rounded-lg flex-1 flex flex-col relative overflow-hidden border border-slate-700/50" style={{ minHeight: '350px' }}>
              {/* WhatsApp Dark Background */}
              <div className="absolute inset-0 opacity-40 pointer-events-none" 
                style={{ 
                  backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                  backgroundSize: '400px',
                  backgroundRepeat: 'repeat'
                }}>
              </div>
              
              {/* WhatsApp Header */}
              <div className="whatsapp-header">
                <div className="whatsapp-header__avatar">🟢</div>
                <div className="whatsapp-header__info">
                  <div className="whatsapp-header__title">Grupo de Ofertas</div>
                  <div className="whatsapp-header__subtitle">hoje, 12:42</div>
                </div>
              </div>
              
              {/* WhatsApp Preview Bubble */}
              <div className="relative z-10 flex-1 p-4 overflow-y-auto">
                <div className="whatsapp-preview">
                  <div className="whatsapp-preview__bubble">
                    <p className="whitespace-pre-wrap">{previewText}</p>
                    <span className="whatsapp-preview__time">12:42</span>
                  </div>
                </div>
              </div>
              
              {/* Fake input bar */}
              <div className="bg-[#202c33] p-3 flex items-center gap-4 relative z-20">
                <div className="w-6 h-6 rounded-full border-2 border-[#8696a0] opacity-50"></div>
                <div className="flex-1 h-9 bg-[#2a3942] rounded-lg"></div>
                <div className="w-6 h-6 rounded-full bg-[#00a884]"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    </main>
  );
};