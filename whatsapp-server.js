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
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado e pronto!');
  ultimoQR = null;
  connectionStatus = 'ready';
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
  connectionStatus = 'disconnected';
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Cliente desconectado:', reason);
  connectionStatus = 'disconnected';
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

// POST /join-group: Entrar em grupo
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

// === Loop de automação ===
async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn || connectionStatus !== 'ready') {
    return;
  }

  try {
    const keyword = process.env.SHOPEE_KEYWORD || "ofertas";
    const ofertas = await buscarOfertasShopee(keyword);

    if (!ofertas || !ofertas.length) return;

    const groupId = process.env.WHATSAPP_GROUP_ID;
    if (!groupId) return;

    for (const oferta of ofertas.slice(0, 5)) {
      const mensagem = formatarMensagemOferta(oferta);
      try {
        await client.sendMessage(groupId, mensagem);
        console.log('✅ Oferta enviada:', oferta.titulo);
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
