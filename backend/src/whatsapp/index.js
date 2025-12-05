// src/whatsapp/index.js
require('dotenv').config();
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { buscarOfertasShopee } = require('./shopee');

const app = express();
app.use(express.json());

const PORT = process.env.WHATSAPP_PORT || 3000;
const INTERVAL_MINUTES = parseInt(process.env.INTERVAL_MINUTES || '5', 10);

let isAutomationOn = true;
let ultimoQR = null;

// === WhatsApp Client ===
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || 'achady-session',
    dataPath: './.wwebjs_auth'
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
  console.log('✅ WhatsApp conectado e pronto!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Cliente desconectado:', reason);
});

client.initialize();

// === Rotas API ===

// QR atual (pro painel mostrar depois)
app.get('/qr', (req, res) => {
  if (!ultimoQR) return res.status(404).json({ error: 'QR ainda não gerado' });
  res.json({ qr: ultimoQR });
});

// Liga/desliga automação
app.post('/automation', (req, res) => {
  const { status } = req.body;
  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'status deve ser boolean' });
  }
  isAutomationOn = status;
  console.log('⚙️ Automação:', isAutomationOn ? 'LIGADA' : 'DESLIGADA');
  res.json({ success: true, isAutomationOn });
});

// Envio manual
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to e message são obrigatórios' });
  }

  try {
    await client.sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Entrar em grupo via link
app.post('/join-group', async (req, res) => {
  const { inviteLink } = req.body;

  if (!inviteLink || !inviteLink.includes('chat.whatsapp.com/')) {
    return res.status(400).json({ error: 'inviteLink inválido' });
  }

  const inviteCode = inviteLink.split('chat.whatsapp.com/')[1];

  try {
    const chat = await client.acceptInvite(inviteCode);
    console.log('✅ Entrou no grupo:', chat.name);
    res.json({ success: true, groupName: chat.name });
  } catch (err) {
    console.error('Erro ao entrar no grupo:', err.message);
    res.status(500).json({ error: 'Erro ao entrar no grupo' });
  }
});

// Loop de ofertas
async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn) {
    console.log('⏸ Automação pausada.');
    return;
  }

  try {
    console.log('🔍 Buscando ofertas da Shopee...');
    const ofertas = await buscarOfertasShopee();

    if (!ofertas.length) {
      console.log('Nenhuma oferta encontrada.');
      return;
    }

    const groupId = process.env.WHATSAPP_GROUP_ID; // ex: 0000000000-1111111111@g.us
    if (!groupId) {
      console.log('⚠️ WHATSAPP_GROUP_ID não definido no .env');
      return;
    }

    // Envia apenas as 5 primeiras para não floodar
    for (const oferta of ofertas.slice(0, 5)) {
      const mensagem = formatarMensagemOferta(oferta);
      try {
        await client.sendMessage(groupId, mensagem);
        console.log('✅ Oferta enviada:', oferta.titulo);
        // Pequeno delay entre mensagens para evitar ban
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (sendError) {
        console.error('Erro ao enviar oferta específica:', sendError.message);
      }
    }
  } catch (err) {
    console.error('Erro no envio automático:', err.message);
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

// Inicia o loop
setInterval(enviarOfertasPeriodicamente, INTERVAL_MINUTES * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp rodando na porta ${PORT}`);
});