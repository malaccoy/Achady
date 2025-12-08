import React, { useState, useEffect } from 'react';
import { getTemplate, saveTemplate, sendTestMessage } from '../services/api';
import { MOCK_PREVIEW_DATA } from '../constants';
import { MessageSquare, Save, Send, Loader2 } from 'lucide-react';

export const TemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    getTemplate().then(data => setTemplate(data.content));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
        await saveTemplate(template);
        alert('Modelo salvo com sucesso!');
    } catch (e) {
        alert('Erro ao salvar modelo.');
    } finally {
        setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
        await sendTestMessage();
        alert('Mensagem de teste enviada para um dos grupos!');
    } catch(e) {
        alert('Erro ao enviar teste. Verifique se o bot está conectado.');
    } finally {
        setSendingTest(false);
    }
  };

  const previewText = template
    .replace('{{titulo}}', MOCK_PREVIEW_DATA.titulo)
    .replace('{{preco}}', MOCK_PREVIEW_DATA.preco)
    .replace('{{precoOriginal}}', MOCK_PREVIEW_DATA.precoOriginal)
    .replace('{{desconto}}', MOCK_PREVIEW_DATA.desconto)
    .replace('{{link}}', MOCK_PREVIEW_DATA.link);

  return (
    <div className="grid lg:grid-cols-2 gap-6 h-full">
      {/* Editor Column */}
      <div className="card p-6 flex flex-col">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-orange-500" />
          Modelo de Mensagem
        </h2>
        
        <div className="mb-4 text-xs text-slate-400 bg-slate-900/30 p-2 rounded border border-slate-700/50">
            Variáveis disponíveis: <span className="font-mono text-orange-400">{`{{titulo}}`}</span>, <span className="font-mono text-orange-400">{`{{preco}}`}</span>, <span className="font-mono text-orange-400">{`{{precoOriginal}}`}</span>, <span className="font-mono text-orange-400">{`{{desconto}}`}</span>, <span className="font-mono text-orange-400">{`{{link}}`}</span>
        </div>

        <textarea
            className="flex-1 w-full p-4 bg-slate-900/50 border border-slate-700 rounded-md font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-200"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            style={{ minHeight: '300px' }}
        />

        <div className="flex gap-4 mt-6">
            <button 
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
            >
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
                Salvar Modelo
            </button>
            <button 
                onClick={handleSendTest}
                disabled={sendingTest}
                className="flex-1 bg-slate-100 hover:bg-white text-slate-800 border border-slate-300 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
            >
                 {sendingTest ? <Loader2 className="animate-spin w-4 h-4 text-green-600"/> : <Send className="w-4 h-4 text-green-600" />}
                Enviar Teste Agora
            </button>
        </div>
      </div>

      {/* Preview Column */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Prévia (WhatsApp)</h2>
        <div className="bg-[#e5ddd5] p-6 rounded-lg min-h-[400px] flex flex-col relative overflow-hidden">
            {/* Mock Whatsapp BG Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <div className="bg-white p-3 rounded-tr-lg rounded-tl-lg rounded-br-lg shadow-sm max-w-[90%] self-start relative z-10">
                <p className="whitespace-pre-wrap text-sm text-slate-800 break-words leading-relaxed">
                    {previewText}
                </p>
                <div className="text-[10px] text-slate-400 text-right mt-1">
                    12:42
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};