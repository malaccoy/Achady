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

// === Configuração do WhatsApp ===
// Usa 'achady-session-standalone' para não conflitar com a sessão do server.js se rodarem juntos
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

// QR atual (para painel consumir depois)
app.get('/qr', (req, res) => {
  if (!ultimoQR) return res.status(404).json({ error: 'QR ainda não gerado' });
  res.json({ qr: ultimoQR });
});

// Liga/desliga automação
app.post('/automation', (req, res) => {
  const { status } = req.body;
  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'status deve ser boolean (true/false)' });
  }
  isAutomationOn = status;
  console.log('⚙️ Automação agora está:', isAutomationOn ? 'LIGADA' : 'DESLIGADA');
  res.json({ success: true, isAutomationOn });
});

// Envio manual de mensagem (teste)
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to e message são obrigatórios' });
  }

  try {
    // Formatar número se vier apenas digitos (ex: 5511999999999 -> 5511999999999@c.us)
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

// Entrar em grupo via link de convite
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

// === Loop de automação: ofertas Shopee -> grupo WhatsApp ===

async function enviarOfertasPeriodicamente() {
  if (!isAutomationOn) {
    console.log('⏸ Automação pausada, pulando ciclo.');
    return;
  }

  try {
    console.log('🔍 Buscando ofertas da Shopee...');
    
    // Fallback de keywords caso não tenha no .env
    const keyword = process.env.SHOPEE_KEYWORD || "ofertas";
    
    // Usa a função importada do shopee.js
    const ofertas = await buscarOfertasShopee(keyword);

    if (!ofertas || !ofertas.length) {
      console.log('Nenhuma oferta encontrada nesse ciclo.');
      return;
    }

    const groupId = process.env.WHATSAPP_GROUP_ID; // exemplo: 120363025225@g.us
    if (!groupId) {
      console.log('⚠️ WHATSAPP_GROUP_ID não definido no .env, não enviando mensagens.');
      return;
    }

    // Pega até 5 ofertas
    for (const oferta of ofertas.slice(0, 5)) {
      const mensagem = formatarMensagemOferta(oferta);
      try {
        await client.sendMessage(groupId, mensagem);
        console.log('✅ Oferta enviada para o grupo:', oferta.productName || oferta.titulo);
        // Delay 5s para evitar flood
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error('Erro envio msg:', e.message);
      }
    }
  } catch (err) {
    console.error('Erro no envio automático de ofertas:', err.message);
  }
}

function formatarMensagemOferta(oferta) {
  // Ajuste de campos conforme o retorno do shopee.js (pode vir como productName ou titulo)
  const titulo = oferta.productName || oferta.titulo || "Oferta";
  const preco = oferta.priceMin || oferta.preco || 0;
  const link = oferta.offerLink || oferta.link || "";
  const precoOriginal = oferta.priceMax || oferta.precoOriginal;
  const desconto = oferta.priceDiscountRate || oferta.desconto;
  
  // Formatação simples de moeda se for número
  const precoFormatado = typeof preco === 'number' 
    ? preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
    : preco;

  let msg = `🔥 *${titulo}*\n` +
            `💰 Preço: ${precoFormatado}\n`;
            
  if (precoOriginal) msg += `❌ De: ${precoOriginal}\n`;
  if (desconto) msg += `✅ Desconto: ${desconto}\n`;
  
  msg += `🔗 Link: ${link}\n\n` +
         `Achady - Ofertas automáticas 💜`;

  return msg;
}

// Inicia Loop
setInterval(enviarOfertasPeriodicamente, INTERVAL_MINUTES * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp Standalone rodando na porta ${PORT}`);
});