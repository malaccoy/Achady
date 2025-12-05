import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ============================
// SESSÕES E CONFIGURAÇÕES
// ============================
let sessions = {};
let painelConfig = {}; 
// painelConfig[userId] = { 
//   messageTemplate: "texto", 
//   interval: 300000, 
//   groupId: "xxxx" 
// }

// ============================
// CRIAR SESSÃO WHATSAPP
// ============================
async function createSession(userId) {
  if (sessions[userId]) return sessions[userId];

  const client = new Client({
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    },
    authStrategy: new LocalAuth({
      clientId: `achady-session-${userId}`
    })
  });

  sessions[userId] = {
    client,
    qr: null,
    status: "starting",
    botTimer: null
  };

  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    sessions[userId].qr = qrImage;
    sessions[userId].status = "qr";
    console.log("📌 QR gerado:", userId);
  });

  client.on("ready", () => {
    sessions[userId].status = "ready";
    console.log("✅ WhatsApp pronto:", userId);
  });

  await client.initialize();
  return sessions[userId];
}

// ============================
// INICIAR SESSÃO
// ============================
app.post("/start/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = await createSession(userId);

  res.json({
    message: "Sessão iniciada",
    status: session.status
  });
});

// ============================
// PEGAR QR
// ============================
app.get("/qr/:userId", (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (!session) {
    return res.json({ qr: null, status: "not_started" });
  }

  res.json({
    qr: session.qr,
    status: session.status
  });
});

// ============================
// SALVAR CONFIG DO PAINEL
// ============================
app.post("/config/:userId", (req, res) => {
  const { userId } = req.params;
  const { messageTemplate, interval } = req.body;

  painelConfig[userId] = {
    ...(painelConfig[userId] || {}),
    messageTemplate,
    interval
  };

  res.json({ success: true });
});

// ============================
// ENTRAR NO GRUPO + MENSAGEM AUTOMÁTICA
// ============================
app.post("/join/:userId", async (req, res) => {
  const { userId } = req.params;
  const { invite } = req.body;

  const session = sessions[userId];

  if (!session || session.status !== "ready") {
    return res.status(400).json({ error: "WhatsApp não está pronto" });
  }

  try {
    const code = invite.split("/").pop();
    const groupId = await session.client.acceptInvite(code);

    painelConfig[userId] = {
      ...(painelConfig[userId] || {}),
      groupId
    };

    await session.client.sendMessage(
      groupId,
      "✅ *Achady conectado com sucesso!*\n🤖 Automação ativada."
    );

    res.json({
      success: true,
      message: "Entrou no grupo com sucesso!"
    });
  } catch (err) {
    res.status(500).json({
      error: "Erro ao entrar no grupo",
      details: err.message
    });
  }
});

// ============================
// INICIAR ROBÔ AUTOMÁTICO
// ============================
app.post("/bot/start/:userId", async (req, res) => {
  const { userId } = req.params;

  const session = sessions[userId];
  const config = painelConfig[userId];

  if (!session || session.status !== "ready") {
    return res.status(400).json({ error: "WhatsApp não pronto" });
  }

  if (!config?.groupId || !config?.messageTemplate || !config?.interval) {
    return res.status(400).json({ error: "Configuração incompleta no painel" });
  }

  if (session.botTimer) {
    clearInterval(session.botTimer);
  }

  session.botTimer = setInterval(async () => {
    try {
      // 🔥 AQUI ENTRA A SHOPEE API DEPOIS
      // const oferta = await buscarOfertaShopee();

      let mensagem = config.messageTemplate
        .replace("{{titulo}}", "Produto Exemplo")
        .replace("{{preco}}", "R$ 79,90")
        .replace("{{link}}", "https://shopee.com.br");

      await session.client.sendMessage(config.groupId, mensagem);
      console.log("✅ Oferta enviada automática");

    } catch (err) {
      console.log("❌ Erro no envio automático:", err.message);
    }
  }, config.interval);

  res.json({ success: true, message: "Robô automático ativado" });
});

// ============================
// PARAR ROBÔ
// ============================
app.post("/bot/stop/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (session?.botTimer) {
    clearInterval(session.botTimer);
    session.botTimer = null;
  }

  res.json({ success: true, message: "Robô desligado" });
});

// ============================
// ENVIAR MENSAGEM MANUAL (MANTIDO PARA COMPATIBILIDADE)
// ============================
app.post("/send/:userId", async (req, res) => {
  const { userId } = req.params;
  const { groupId, message } = req.body;

  const session = sessions[userId];

  if (!session || session.status !== "ready") {
    return res.status(400).json({ error: "WhatsApp não está pronto" });
  }

  try {
    await session.client.sendMessage(groupId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// ROTA PRINCIPAL
// ============================
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Achady está rodando 🚀");
});

// ============================
app.listen(3000, () => {
  console.log("🌐 Servidor rodando na porta 3000");
});