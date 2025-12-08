import React, { useState, useEffect } from 'react';
import { getTemplate, saveTemplate, sendTestOffer } from '../services/api';
import { MOCK_PREVIEW_DATA, DEFAULT_TEMPLATE } from '../constants';
import { MessageSquare, Save, Send, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

export const TemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
    <div className="grid lg:grid-cols-2 gap-6 h-full">
      {/* Editor Column */}
      <div className="card p-6 flex flex-col h-full">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-orange-500" />
          Modelo de Mensagem
        </h2>
        
        <div className="mb-4 text-xs text-slate-400 bg-slate-900/30 p-3 rounded border border-slate-700/50 flex gap-2 items-start">
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

        <textarea
            className="flex-1 w-full p-4 bg-slate-900/50 border border-slate-700 rounded-md font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-200 leading-relaxed"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            style={{ minHeight: '300px' }}
        />

        {statusMsg && (
            <div className={`mt-4 p-3 rounded text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1
                ${statusMsg.type === 'success' ? 'bg-green-900/20 text-green-300 border border-green-900/30' : 'bg-red-900/20 text-red-300 border border-red-900/30'}`}>
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                {statusMsg.text}
            </div>
        )}

        <div className="flex gap-4 mt-6">
            <button 
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
                Salvar Modelo
            </button>
            <button 
                onClick={handleSendTest}
                disabled={sendingTest}
                className="flex-1 bg-slate-100 hover:bg-white text-slate-800 border border-slate-300 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                 {sendingTest ? <Loader2 className="animate-spin w-4 h-4 text-green-700"/> : <Send className="w-4 h-4 text-green-700" />}
                Enviar Teste Agora
            </button>
        </div>
      </div>

      {/* Preview Column */}
      <div className="card p-6 h-full flex flex-col">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Prévia (WhatsApp)</h2>
        <div className="bg-[#0b141a] p-0 rounded-lg flex-1 flex flex-col relative overflow-hidden border border-slate-700/50">
            {/* WhatsApp Dark Background */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                     backgroundSize: '400px',
                     backgroundRepeat: 'repeat'
                 }}>
            </div>
            
            <div className="relative z-10 flex-1 p-4 overflow-y-auto">
                <div className="bg-[#202c33] p-2.5 rounded-tr-lg rounded-tl-none rounded-br-lg rounded-bl-lg shadow-sm max-w-[90%] self-start text-left inline-block">
                    <p className="whitespace-pre-wrap text-[14.2px] text-[#e9edef] break-words leading-snug font-sans">
                        {previewText}
                    </p>
                    <div className="flex justify-end items-center gap-1 mt-1">
                        <span className="text-[11px] text-[#8696a0]">
                            12:42
                        </span>
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
    </div>
  );
};