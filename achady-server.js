// achady-server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// =======================
// "Banco de dados" em memória
// =======================
let groups = []; // { id, name, link, active, chatId? }
let logs = [];   // { when, group, title, price, status, error? }
let template =
  '🔥 Oferta Shopee!\n' +
  '{{titulo}}\n' +
  'De {{precoOriginal}} por apenas {{preco}} ({{desconto}} OFF)\n' +
  '👉 Compre agora: {{link}}';

let automationConfig = {
  active: false,
  intervalMinutes: 5,
};
let automationTimer = null;

// Configuração da API de Afiliados Shopee
let shopeeConfig = {
  appId: process.env.SHOPEE_APP_ID || null,
  secret: process.env.SHOPEE_APP_SECRET || null,
};

// =======================
// WhatsApp Client
// =======================
let whatsappStatus = 'disconnected'; // disconnected | qr | ready | auth_failure
let lastQrString = null;
let clientInitialized = false;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'achady' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  whatsappStatus = 'qr';
  lastQrString = qr;
  console.log('[WHATSAPP] QR recebido, exiba no painel e leia com o celular.');
});

client.on('ready', () => {
  whatsappStatus = 'ready';
  console.log('[WHATSAPP] Cliente pronto e conectado.');
});

client.on('auth_failure', (msg) => {
  whatsappStatus = 'auth_failure';
  console.error('[WHATSAPP] Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  whatsappStatus = 'disconnected';
  console.log('[WHATSAPP] Desconectado:', reason);
});

function ensureClientInitialized() {
  if (!clientInitialized) {
    client.initialize();
    clientInitialized = true;
    console.log('[WHATSAPP] Inicializando cliente...');
  }
}

// =======================
// Helpers Shopee API
// =======================
function buildShopeeHeaders(payloadObj) {
  const { appId, secret } = shopeeConfig;

  if (!appId || !secret) {
    throw new Error('Credenciais da Shopee não configuradas');
  }

  const timestamp = Math.floor(Date.now() / 1000); // segundos
  const payload = JSON.stringify(payloadObj);

  // Fator = AppId + Timestamp + Payload + Secret
  const factor = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto
    .createHash('sha256')
    .update(factor)
    .digest('hex'); // 64 chars, lowercase

  return {
    Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    'Content-Type': 'application/json',
  };
}

function formatMessage(offer) {
  if (!offer) return 'Sem oferta disponível.';

  return template
    .replace(/{{\s*titulo\s*}}/gi, offer.title || '')
    .replace(/{{\s*preco\s*}}/gi, offer.price || '')
    .replace(/{{\s*precoOriginal\s*}}/gi, offer.originalPrice || '')
    .replace(/{{\s*desconto\s*}}/gi, offer.discount || '')
    .replace(/{{\s*link\s*}}/gi, offer.link || '');
}

async function fetchShopeeOffer() {
  // 1. Tenta usar API Oficial se configurada
  if (shopeeConfig.appId && shopeeConfig.secret) {
    try {
      // Endpoint GraphQL da Shopee
      const endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';

      const query = `
        query brandOfferList($page: Int!, $size: Int!) {
          brandOffer {
            nodes(page: $page, size: $size) {
              offerName
              commissionRate
              targetUrl
              imageUrl
            }
          }
        }
      `;

      const variables = { page: 1, size: 1 };
      const payload = { query, variables };

      const headers = buildShopeeHeaders(payload);

      console.log('[SHOPEE API] Buscando oferta via GraphQL...');
      const { data } = await axios.post(endpoint, payload, { headers });

      if (data.errors && data.errors.length) {
        console.error('[SHOPEE API] Erro GraphQL:', JSON.stringify(data.errors));
        throw new Error('Erro na resposta GraphQL');
      }

      const nodes = data?.data?.brandOffer?.nodes || [];
      const first = nodes[0];

      if (first) {
        const priceText = '—'; // API de afiliados foca em comissão, preço varia
        return {
          title: first.offerName || 'Oferta Shopee',
          price: priceText,
          originalPrice: '',
          discount: first.commissionRate
            ? `${first.commissionRate}% comissão`
            : '',
          link: first.targetUrl || 'https://shopee.com.br',
          imageUrl: first.imageUrl || null,
        };
      } else {
         console.warn('[SHOPEE API] Nenhuma oferta retornada na lista.');
      }
    } catch (err) {
      console.error('[SHOPEE API] Erro ao buscar oferta (fallback para scraping):', err.message);
    }
  }

  // 2. Fallback: SCRAPING ANTIGO
  console.log('[SHOPEE] Usando método Scraping (Axios + HTML)...');
  const url = process.env.SHOPEE_SEARCH_URL;

  if (!url) {
    console.warn(
      '[SHOPEE] SHOEPEE_SEARCH_URL não configurada. Retornando oferta fake para testes.'
    );
    return {
      title: 'Produto de teste ACHADY',
      price: 'R$ 49,90',
      originalPrice: 'R$ 99,90',
      discount: '50%',
      link: 'https://shopee.com.br',
      imageUrl: null,
    };
  }

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'accept-language': 'pt-BR,pt;q=0.9',
      },
    });

    const $ = cheerio.load(html);

    const firstItem = $('a').first();

    if (!firstItem || !firstItem.attr('href')) {
      console.warn('[SHOPEE] Nenhum item encontrado no HTML. Ajuste os seletores.');
      return null;
    }

    const title = firstItem.text().trim() || 'Oferta Shopee';
    const link = firstItem.attr('href').startsWith('http')
      ? firstItem.attr('href')
      : 'https://shopee.com.br' + firstItem.attr('href');

    return {
      title,
      price: 'R$ 49,90',
      originalPrice: 'R$ 99,90',
      discount: '50%',
      link,
      imageUrl: null,
    };
  } catch (err) {
    console.error('[SHOPEE] Erro no scraping:', err.message);
    return null;
  }
}

async function sendOfferToAllActiveGroups(offer) {
  if (whatsappStatus !== 'ready') {
    console.warn('[WHATSAPP] Não está pronto. Cancelando envio.');
    return;
  }

  const activeGroups = groups.filter((g) => g.active);
  const message = formatMessage(offer);
  const when = new Date().toISOString();

  // Prepara mídia se houver imagem
  let media = null;
  if (offer.imageUrl) {
    try {
      console.log(`[WHATSAPP] Baixando imagem da oferta: ${offer.imageUrl}`);
      const response = await axios.get(offer.imageUrl, { responseType: 'arraybuffer' });
      const mimetype = response.headers['content-type'] || 'image/jpeg';
      const data = Buffer.from(response.data, 'binary').toString('base64');
      media = new MessageMedia(mimetype, data, 'oferta.jpg');
    } catch (imgErr) {
      console.error('[WHATSAPP] Erro ao baixar imagem (enviando apenas texto):', imgErr.message);
      media = null;
    }
  }

  for (const g of activeGroups) {
    try {
      if (!g.chatId) {
        console.warn(
          '[WHATSAPP] Grupo sem chatId configurado. Use o join via link no painel.',
          g
        );
        logs.push({
          when,
          group: g.name,
          title: offer?.title,
          price: offer?.price,
          status: 'erro',
          error: 'Grupo sem chatId configurado',
        });
        continue;
      }

      if (media) {
        await client.sendMessage(g.chatId, media, { caption: message });
      } else {
        await client.sendMessage(g.chatId, message);
      }

      logs.push({
        when,
        group: g.name,
        title: offer?.title,
        price: offer?.price,
        status: 'enviado',
      });
    } catch (err) {
      console.error('[WHATSAPP] Erro enviando para grupo', g.name, err.message);
      logs.push({
        when,
        group: g.name,
        title: offer?.title,
        price: offer?.price,
        status: 'erro',
        error: err.message,
      });
    }
  }
}

// =======================
// Automação
// =======================
function startAutomationLoop() {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }

  if (!automationConfig.active) {
    console.log('[AUTOMACAO] Desativada.');
    return;
  }

  const ms = automationConfig.intervalMinutes * 60 * 1000;
  console.log(
    `[AUTOMACAO] Ativa. Rodando a cada ${automationConfig.intervalMinutes} minuto(s).`
  );

  automationTimer = setInterval(async () => {
    console.log('[AUTOMACAO] Executando ciclo automático...');
    try {
      const offer = await fetchShopeeOffer();
      if (!offer) {
        console.log('[AUTOMACAO] Nenhuma oferta retornada.');
        return;
      }
      await sendOfferToAllActiveGroups(offer);
    } catch (err) {
      console.error('[AUTOMACAO] Erro no ciclo:', err.message);
    }
  }, ms);
}

// =======================
// WhatsApp Join Helpers
// =======================

function extractInviteCode(link) {
  try {
    const clean = link.trim();
    // Regex para pegar código de 20+ caracteres alfanuméricos
    // Suporta formats: chat.whatsapp.com/CODE, chat.whatsapp.com/invite/CODE
    const match = clean.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{20,})/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

function normalizeChatId(input) {
  if (!input) return null;
  if (typeof input === 'string') return input;
  // Estrutura do objeto Id do wwebjs
  if (input._serialized) return input._serialized;
  // Estrutura de Chat que contém .id
  if (input.id && input.id._serialized) return input.id._serialized;
  return null;
}

// =======================
// ROUTER SETUP
// =======================
const router = express.Router();

// --- WHATSAPP ROUTES ---
router.get('/whatsapp/qr', async (req, res) => {
  try {
    ensureClientInitialized();

    if (!lastQrString) {
      return res.json({ status: whatsappStatus, qr: null });
    }

    const dataUrl = await qrcode.toDataURL(lastQrString);
    return res.json({ status: whatsappStatus, qr: dataUrl });
  } catch (err) {
    console.error('[API] /whatsapp/qr erro:', err.message);
    return res.status(500).json({ error: 'Erro ao gerar QR Code.' });
  }
});

router.get('/whatsapp/status', (req, res) => {
  return res.json({ status: whatsappStatus });
});

// --- SHOPEE CONFIG ROUTES ---
router.get('/shopee/config', (req, res) => {
  res.json({
    hasCredentials: !!(shopeeConfig.appId && shopeeConfig.secret),
    appIdMasked: shopeeConfig.appId
      ? shopeeConfig.appId.slice(0, 3) + '****' + shopeeConfig.appId.slice(-2)
      : null,
  });
});

router.post('/shopee/config', (req, res) => {
  const { appId, secret } = req.body;
  if (!appId || !secret) {
    return res.status(400).json({ error: 'appId e secret são obrigatórios' });
  }
  shopeeConfig.appId = appId;
  shopeeConfig.secret = secret;
  console.log('[SHOPEE API] Credenciais atualizadas via painel.');
  res.json({ ok: true });
});

// --- GROUP ROUTES ---
router.get('/groups', (req, res) => {
  res.json(groups);
});

router.post('/groups', (req, res) => {
  const { link, name } = req.body;
  if (!link) {
    return res.status(400).json({ error: 'link é obrigatório' });
  }
  const id = Date.now().toString();
  const group = {
    id,
    link,
    name: name || 'Grupo sem nome',
    active: true,
    chatId: null,
  };
  groups.push(group);
  res.status(201).json(group);
});

router.patch('/groups/:id/toggle', (req, res) => {
  const { id } = req.params;
  const group = groups.find((g) => g.id === id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });
  group.active = !group.active;
  res.json(group);
});

router.delete('/groups/:id', (req, res) => {
  const { id } = req.params;
  const exists = groups.some((g) => g.id === id);
  if (!exists) return res.status(404).json({ error: 'Grupo não encontrado' });
  groups = groups.filter((g) => g.id !== id);
  res.status(204).send();
});

router.post('/groups/:id/join', async (req, res) => {
  const { id } = req.params;
  const group = groups.find((g) => g.id === id);
  
  if (!group) {
    return res.status(404).json({ ok: false, error: 'Grupo não encontrado' });
  }

  if (whatsappStatus !== 'ready') {
    return res.status(400).json({ ok: false, error: 'WhatsApp não está pronto. Conecte primeiro pelo QR.' });
  }

  try {
    // 1. Extração segura do Invite Code
    const inviteCode = extractInviteCode(group.link);

    if (!inviteCode) {
       return res.status(400).json({ ok: false, error: 'Link de convite inválido ou formato não reconhecido.' });
    }

    console.log(`[WHATSAPP] join group id=${id} code=${inviteCode.substring(0, 6)}...`);

    // 2. Tenta obter info do convite antes de entrar (útil para pegar nome e ID se já estiver no grupo)
    let inviteInfo = null;
    try {
      inviteInfo = await client.getInviteInfo(inviteCode);
    } catch (infoErr) {
      console.warn('[WHATSAPP] Falha ao obter info do convite:', infoErr.message);
    }

    // 3. Tenta entrar no grupo
    let targetChatId = null;

    try {
      const inviteResult = await client.acceptInvite(inviteCode);
      // O result pode ser string, objeto ou undefined dependendo da versão
      targetChatId = normalizeChatId(inviteResult);
    } catch (joinErr) {
      const msg = joinErr.message ? joinErr.message.toLowerCase() : '';
      
      // Se o erro indicar que JÁ ESTÁ no grupo, usamos o ID vindo do inviteInfo
      if (msg.includes('already') || msg.includes('participant') || msg.includes('member') || msg.includes('joined')) {
         console.log('[WHATSAPP] Bot já está no grupo, recuperando ID via inviteInfo.');
         if (inviteInfo && inviteInfo.id) {
            targetChatId = normalizeChatId(inviteInfo.id);
         }
      } else {
        // Se for outro erro, lançamos para o catch principal
        throw joinErr;
      }
    }

    // 4. Fallback final para ID
    if (!targetChatId && inviteInfo && inviteInfo.id) {
       targetChatId = normalizeChatId(inviteInfo.id);
    }

    if (!targetChatId) {
        throw new Error('Não foi possível identificar o ID do grupo após tentativa de entrada.');
    }

    // 5. Atualiza registro do grupo
    group.chatId = targetChatId;
    group.active = true;

    // Atualiza nome se for genérico e tivermos info
    if (group.name === 'Grupo sem nome' && inviteInfo && inviteInfo.subject) {
      group.name = inviteInfo.subject;
    } else {
      // Tenta buscar nome atualizado do chat
      try {
        const chatInfo = await client.getChatById(targetChatId);
        if (chatInfo && (chatInfo.name || chatInfo.formattedTitle)) {
           group.name = chatInfo.name || chatInfo.formattedTitle;
        }
      } catch (metaErr) {}
    }
    
    console.log(`[WHATSAPP] Sucesso join: ${group.name} (${targetChatId})`);

    res.json({ 
        ok: true, 
        message: 'Entrou no grupo com sucesso.', 
        chatId: targetChatId,
        name: group.name,
        group 
    });

  } catch (err) {
    console.error('[WHATSAPP] join error:', err.message);
    res.status(500).json({ ok: false, error: 'Erro ao entrar no grupo.', message: err.message });
  }
});

// --- AUTOMATION ROUTES ---
router.get('/automation', (req, res) => {
  res.json(automationConfig);
});

router.patch('/automation/status', (req, res) => {
  const { ativo } = req.body;
  automationConfig.active = !!ativo;
  startAutomationLoop();
  res.json(automationConfig);
});

router.patch('/automation/interval', (req, res) => {
  const { intervalMinutes } = req.body;
  const n = Number(intervalMinutes);
  if (!n || n <= 0) {
    return res.status(400).json({ error: 'intervalMinutes inválido' });
  }
  automationConfig.intervalMinutes = n;
  startAutomationLoop();
  res.json(automationConfig);
});

router.post('/automation/run-once', async (req, res) => {
  try {
    const offer = await fetchShopeeOffer();
    if (!offer) return res.status(500).json({ error: 'Nenhuma oferta encontrada.' });
    await sendOfferToAllActiveGroups(offer);
    res.json({ ok: true, offer });
  } catch (err) {
    console.error('[API] /automation/run-once erro:', err.message);
    res.status(500).json({ error: 'Erro ao executar automação uma vez.' });
  }
});

router.post('/test/send', async (req, res) => {
  try {
    const offer = await fetchShopeeOffer();
    if (!offer) return res.status(500).json({ error: 'Nenhuma oferta encontrada.' });
    await sendOfferToAllActiveGroups(offer);
    res.json({ ok: true, offer });
  } catch (err) {
    console.error('[API] /test/send erro:', err.message);
    res.status(500).json({ error: 'Erro ao enviar teste.' });
  }
});

// --- TEMPLATE & LOGS ---
router.get('/template', (req, res) => {
  res.json({ template });
});

router.post('/template', (req, res) => {
  const { template: newTemplate } = req.body;
  if (!newTemplate) return res.status(400).json({ error: 'template é obrigatório' });
  template = newTemplate;
  res.json({ template });
});

router.get('/logs', (req, res) => {
  const last = logs.slice(-200);
  res.json(last);
});

// =======================
// MOUNT ROUTER
// =======================
// Monta o roteador tanto em /api quanto na raiz
// Isso resolve problemas de proxy que enviam /api/... ou /...
app.use('/api', router);
app.use('/', router);

// Rota raiz para Health Check
app.get('/', (req, res) => {
  res.send('ACHADY Backend Online 🚀');
});

// =======================
// Start Server
// =======================
app.listen(PORT, () => {
  console.log(`ACHADY backend rodando na porta ${PORT}`);
  ensureClientInitialized(); // já começa a inicializar o WhatsApp
});