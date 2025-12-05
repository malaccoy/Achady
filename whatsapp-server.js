import dotenv from 'dotenv';
import express from 'express';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { buscarOfertasShopee } from './shopee.js';

dotenv.config();

const { Client, LocalAuth } = pkg;
const app = express();

app.use(express.json());

const PORT = process.env.WHATSAPP_PORT || 3001;
const INTERVAL_MINUTES = parseInt(process.env.INTERVAL_MINUTES || '5', 10);

let isAutomationOn = true;
let ultimoQR = null;
let connectionStatus = 'disconnected'; // disconnected, qr, ready
let isWhatsappReady = false; // Tracks actual readiness

// Global variable for the active group ID (defaults to .env if available)
let currentGroupId = process.env.WHATSAPP_GROUP_ID || null;

// === Configuração do WhatsApp ===
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || 'achady-session-standalone',
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('QR RECEBIDO, escaneie com o WhatsApp:');
  qrcode.generate(qr, { small: true });
  ultimoQR = qr;
  connectionStatus = 'qr';
  isWhatsappReady = false;
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado e pronto!');
  ultimoQR = null;
  connectionStatus = 'ready';
  isWhatsappReady = true;
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
  connectionStatus = 'disconnected';
  isWhatsappReady = false;
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Cliente desconectado:', reason);
  connectionStatus = 'disconnected';
  isWhatsappReady = false;
  ultimoQR = null;
  // Opcional: tentar reconectar
  client.initialize();
});

client.initialize();

// === Rotas API ===

// GET /qr: Retorna QR e Status atual
app.get('/qr', (req, res) => {
  res.json({ 
    qr: ultimoQR, 
    status: connectionStatus 
  });
});

// GET /status: Retorna status detalhado (Conexão e Configs)
app.get('/status', (req, res) => {
  const connected = isWhatsappReady;
  // Verifica se existe URL da Shopee configurada (mesmo que seja default)
  const shopeeConfigured = Boolean(process.env.SHOPEE_URL || process.env.SHOPEE_KEYWORD);
  
  // Verifica se o grupo está configurado na memória ou no ENV
  const groupConfigured = Boolean(currentGroupId || process.env.WHATSAPP_GROUP_ID);

  return res.json({
    connected,
    shopeeConfigured,
    groupConfigured,
    automationEnabled: isAutomationOn,
    currentGroupId // Debug info
  });
});

// POST /config/group: Define manualmente qual grupo será usado pelo robô
app.post('/config/group', (req, res) => {
  const { groupId } = req.body;

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'groupId obrigatório' });
  }

  currentGroupId = groupId;
  console.log('⚙️ Grupo padrão atualizado via API para:', currentGroupId);

  return res.json({
    success: true,
    groupId: currentGroupId,
  });
});

// GET /groups: Listar grupos e IDs
app.get('/groups', async (req, res) => {
  if (!isWhatsappReady) {
    return res.status(503).json({ error: 'WhatsApp ainda não está pronto.' });
  }

  try {
    const chats = await client.getChats();
    const groups = chats
      .filter((chat) => chat.isGroup)
      .map((g) => ({
        id: g.id._serialized,
        name: g.name,
      }));

    res.json(groups);
  } catch (err) {
    console.error('Erro ao listar grupos:', err.message);
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

// POST /automation: Liga/desliga automação
app.post('/automation', (req, res) => {
  const { status } = req.body;
  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'status deve ser boolean (true/false)' });
  }
  isAutomationOn = status;
  console.log('⚙️ Automação agora está:', isAutomationOn ? 'LIGADA' : 'DESLIGADA');
  res.json({ success: true, isAutomationOn });
});

// POST /send-message: Envio manual
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to e message são obrigatórios' });
  }

  try {
    let chatId = to;
    if (!chatId.includes('@') && !chatId.includes('-')) {
      chatId = `${chatId}@c.us`;
    }

    await client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// POST /join-group: Entrar em grupo via link e retornar ID
app.post('/join-group', async (req, res) => {
  const { inviteLink } = req.body;

  if (!inviteLink || !inviteLink.includes('chat.whatsapp.com/')) {
    return res.status(400).json({ error: 'inviteLink inválido' });
  }

  const inviteCode = inviteLink.split('chat.whatsapp.com/')[1];

  try {
    const chat = await client.acceptInvite(inviteCode);
    const groupId = chat.id._serialized;
    
    console.log('✅ Entrou no grupo:', chat.name, 'ID:', groupId);
    
    // Auto-configura como padrão se ainda não houver um, OU sempre (conforme preferência do usuário de não editar ENV)
    if (!currentGroupId) {
        currentGroupId = groupId;
        console.log('⚙️ Auto-configurado como grupo padrão (Join):', currentGroupId);
    }

    res.json({ 
        success: true, 
        groupName: chat.name,
        groupId: groupId
    });
  } catch (err) {
    console.error('Erro ao entrar no grupo:', err.message);
    res.status(500).json({ error: 'Erro ao entrar no grupo' });
  }
});

// === Loop de automação ===
async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn || connectionStatus !== 'ready') {
    return;
  }

  try {
    const keyword = process.env.SHOPEE_KEYWORD || "ofertas";
    const ofertas = await buscarOfertasShopee(keyword);

    if (!ofertas || !ofertas.length) return;

    // Usa a variável global atualizada em tempo real, ou fallback para ENV
    const groupId = currentGroupId || process.env.WHATSAPP_GROUP_ID;

    if (!groupId) {
        console.log('⚠️ Nenhum WHATSAPP_GROUP_ID configurado (currentGroupId vazio), não enviando mensagens.');
        return;
    }

    for (const oferta of ofertas.slice(0, 5)) {
      const mensagem = formatarMensagemOferta(oferta);
      try {
        await client.sendMessage(groupId, mensagem);
        console.log('✅ Oferta enviada para o grupo:', oferta.titulo);
        await new Promise(r => setTimeout(r, 8000));
      } catch (e) {
        console.error('Erro envio msg:', e.message);
      }
    }
  } catch (err) {
    console.error('Erro automação:', err.message);
  }
}

function formatarMensagemOferta(oferta) {
  const titulo = oferta.productName || oferta.titulo || "Oferta";
  const preco = oferta.priceMin || oferta.preco || 0;
  const link = oferta.offerLink || oferta.link || "";
  const precoOriginal = oferta.priceMax || oferta.precoOriginal;
  const desconto = oferta.priceDiscountRate || oferta.desconto;
  
  const precoFormatado = typeof preco === 'number' 
    ? preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
    : preco;

  let msg = `🔥 *${titulo}*\n` +
            `💰 Preço: ${precoFormatado}\n`;
            
  if (precoOriginal) msg += `❌ De: ${precoOriginal}\n`;
  if (desconto) msg += `✅ Desconto: ${desconto}\n`;
  
  msg += `🔗 Link: ${link}\n\nAchady - Ofertas automáticas 💜`;
  return msg;
}

setInterval(enviarOfertasPeriodicamente, INTERVAL_MINUTES * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp Standalone rodando na porta ${PORT}`);
});