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

// Global State
let isAutomationOn = true;
let ultimoQR = null;

// 1.1) Adicionar variáveis globais de estado
let isWhatsappReady = false;
let currentGroupId = process.env.WHATSAPP_GROUP_ID || null;

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
});

// 1.2) Marcar quando o WhatsApp conecta
client.on('ready', () => {
  isWhatsappReady = true;
  console.log('✅ WhatsApp conectado e pronto!');
  ultimoQR = null;
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
  isWhatsappReady = false;
});

// 1.3) Marcar quando o WhatsApp desconecta
client.on('disconnected', (reason) => {
  isWhatsappReady = false;
  console.log('⚠️ Cliente desconectado:', reason);
});

client.initialize();

// === Rotas API ===

app.get('/qr', (req, res) => {
  res.json({ 
    qr: ultimoQR, 
    status: isWhatsappReady ? 'connected' : (ultimoQR ? 'qr' : 'disconnected')
  });
});

// 1.4) Criar a rota GET /status
app.get('/status', (req, res) => {
  const connected = isWhatsappReady;
  const shopeeConfigured = Boolean(process.env.SHOPEE_URL);
  const groupConfigured = Boolean(currentGroupId || process.env.WHATSAPP_GROUP_ID);

  return res.json({
    connected,
    shopeeConfigured,
    groupConfigured,
  });
});

app.get('/groups', async (req, res) => {
  if (!isWhatsappReady) {
    return res.status(503).json({ error: 'WhatsApp ainda não está pronto.' });
  }
  try {
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup).map((g) => ({ id: g.id._serialized, name: g.name }));
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

app.post('/config/group', (req, res) => {
  const { groupId } = req.body;
  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'groupId obrigatório' });
  }
  currentGroupId = groupId;
  console.log('⚙️ Grupo padrão atualizado via API para:', currentGroupId);
  return res.json({ success: true, groupId: currentGroupId });
});

app.post('/automation', (req, res) => {
  const { status } = req.body;
  if (typeof status !== 'boolean') return res.status(400).json({ error: 'status deve ser boolean' });
  isAutomationOn = status;
  console.log('⚙️ Automação:', isAutomationOn ? 'LIGADA' : 'DESLIGADA');
  res.json({ success: true, isAutomationOn });
});

app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Obrigatório: to, message' });
  try {
    let chatId = to;
    if (!chatId.includes('@') && !chatId.includes('-')) chatId = `${chatId}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro envio manual:', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

app.post('/join-group', async (req, res) => {
  const { inviteLink } = req.body;
  if (!inviteLink || !inviteLink.includes('chat.whatsapp.com/')) return res.status(400).json({ error: 'Link inválido' });
  try {
    const code = inviteLink.split('chat.whatsapp.com/')[1];
    const chat = await client.acceptInvite(code);
    const groupId = chat.id._serialized;
    console.log('✅ Entrou no grupo:', chat.name, groupId);
    if (!currentGroupId) {
      currentGroupId = groupId;
      console.log('⚙️ Auto-configurado como padrão:', currentGroupId);
    }
    res.json({ success: true, groupName: chat.name, groupId });
  } catch (err) {
    console.error('Erro join:', err);
    res.status(500).json({ error: 'Erro ao entrar no grupo' });
  }
});

// 1.3) Garantir que o envio automático usa currentGroupId
async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn || !isWhatsappReady) return;

  try {
    console.log('🔍 Buscando ofertas da Shopee...');
    const keyword = process.env.SHOPEE_KEYWORD || "ofertas";
    const ofertas = await buscarOfertasShopee(keyword);

    if (!ofertas || !ofertas.length) return;

    const groupId = currentGroupId;
    if (!groupId) {
      console.log('⚠️ WHATSAPP_GROUP_ID não definido no .env ou currentGroupId vazio, não enviando mensagens.');
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