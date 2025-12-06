// whatsapp-server.js - servidor WhatsApp standalone do ACHADY

// Carrega variáveis de ambiente
require('dotenv').config();

const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { buscarOfertasShopee } = require('./shopee'); // função já existe no projeto

// ==== CONFIG BÁSICA ====

const app = express();
app.use(express.json());

const PORT = process.env.WHATSAPP_PORT || 3001;
const INTERVAL_MINUTES = parseInt(process.env.INTERVAL_MINUTES || '5', 10);

// Estado do robô / sessão
let isAutomationOn = true;
let ultimoQR = null;
let isWhatsappReady = false;
let currentGroupId = process.env.WHATSAPP_GROUP_ID || null;

// ==== CLIENT WHATSAPP ====

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || 'achady-session',
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

client.on('ready', () => {
  isWhatsappReady = true;
  console.log('✅ WhatsApp conectado e pronto!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  isWhatsappReady = false;
  console.log('⚠️ Cliente desconectado:', reason);
});

client.initialize();

// ==== ROTAS HTTP ====

/**
 * Retorna o QR atual (texto) - usado pela Vercel para gerar imagem
 */
app.get('/qr', (req, res) => {
  if (!ultimoQR) {
    return res.status(404).json({ error: 'QR ainda não gerado' });
  }
  return res.json({ qr: ultimoQR });
});

/**
 * Status geral da conexão e configurações
 */
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

/**
 * Liga/desliga automação
 */
app.post('/automation', (req, res) => {
  const { status } = req.body;
  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'status deve ser boolean (true/false)' });
  }
  isAutomationOn = status;
  console.log('⚙️ Automação agora está:', isAutomationOn ? 'LIGADA' : 'DESLIGADA');
  return res.json({ success: true, isAutomationOn });
});

/**
 * Envio manual de mensagem (teste)
 * body: { to: "55DDDNUMERO@c.us" ou "ID_DO_GRUPO@g.us", message: "texto" }
 */
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to e message são obrigatórios' });
  }

  try {
    await client.sendMessage(to, message);
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

/**
 * Entrar em grupo via link de convite
 * body: { inviteLink: "https://chat.whatsapp.com/..." }
 */
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

    // se ainda não tiver grupo padrão, define este
    if (!currentGroupId) {
      currentGroupId = groupId;
      console.log('⚙️ currentGroupId definido para:', currentGroupId);
    }

    return res.json({
      success: true,
      groupName: chat.name,
      groupId,
    });
  } catch (err) {
    console.error('Erro ao entrar no grupo:', err.message);
    return res.status(500).json({ error: 'Erro ao entrar no grupo' });
  }
});

/**
 * Configurar explicitamente o grupo padrão
 * body: { groupId: "....@g.us" }
 */
app.post('/config/group', (req, res) => {
  const { groupId } = req.body;

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'groupId obrigatório' });
  }

  currentGroupId = groupId;
  console.log('⚙️ Grupo padrão atualizado para:', currentGroupId);

  return res.json({
    success: true,
    groupId: currentGroupId,
  });
});

/**
 * Listar grupos (para debug)
 */
app.get('/groups', async (req, res) => {
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

// ==== LOOP AUTOMÁTICO DE OFERTAS ====

async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn) {
    console.log('⏸ Automação pausada, pulando ciclo.');
    return;
  }

  try {
    console.log('🔍 Buscando ofertas da Shopee...');
    const ofertas = await buscarOfertasShopee();

    if (!ofertas || !ofertas.length) {
      console.log('Nenhuma oferta encontrada nesse ciclo.');
      return;
    }

    const groupId = currentGroupId;
    if (!groupId) {
      console.log('⚠️ WHATSAPP_GROUP_ID não definido no .env e currentGroupId vazio, não enviando mensagens.');
      return;
    }

    for (const oferta of ofertas.slice(0, 5)) {
      const mensagem = formatarMensagemOferta(oferta);
      await client.sendMessage(groupId, mensagem);
      console.log('✅ Oferta enviada para o grupo:', oferta.titulo);
    }
  } catch (err) {
    console.error('Erro no envio automático de ofertas:', err.message);
  }
}

function formatarMensagemOferta(oferta) {
  return (
    `🔥 *${oferta.titulo}*\n` +
    `💰 Preço: ${oferta.preco}\n` +
    (oferta.precoOriginal ? `❌ De: ${oferta.precoOriginal}\n` : '') +
    (oferta.desconto ? `✅ Desconto: ${oferta.desconto}\n` : '') +
    `🔗 Link: ${oferta.link}\n\n` +
    `Achady - Ofertas automáticas 💜`
  );
}

// dispara o ciclo a cada X minutos
setInterval(enviarOfertasPeriodicamente, INTERVAL_MINUTES * 60 * 1000);

// ==== INICIA SERVIDOR HTTP ====

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp rodando na porta ${PORT}`);
});
