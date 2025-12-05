import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import { buscarOfertas } from "./shopee.js";
import { db } from "./db.js";

const { Client, LocalAuth } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

let sessions = {};
let autoDisparoAtivo = false;
let intervaloMinutos = 30;
let palavraChave = "cozinha";
let mensagemBase = "🔥 OFERTA IMPERDÍVEL:\n{produto}\n💰 De R${preco}\n🛒 {link}";

// ================== SESSÃO ==================

async function createSession(userId) {
  if (sessions[userId]) return sessions[userId];

  const client = new Client({
    puppeteer: { 
      headless: true, 
      args: ["--no-sandbox", "--disable-setuid-sandbox"] 
    },
    authStrategy: new LocalAuth({ clientId: `achady-${userId}` })
  });

  sessions[userId] = { client, qr: null, status: "starting" };

  client.on("qr", async qr => {
    sessions[userId].qr = await qrcode.toDataURL(qr);
    sessions[userId].status = "qr";
  });

  client.on("ready", () => {
    sessions[userId].status = "ready";
    console.log(`✅ WhatsApp pronto (User: ${userId})`);
  });
  
  client.on("disconnected", (reason) => {
    console.log(`❌ WhatsApp desconectado (User: ${userId}):`, reason);
    sessions[userId].status = "disconnected";
    sessions[userId].qr = null;
  });

  client.initialize();
  return sessions[userId];
}

// ================== ROTAS ==================

app.post("/start/:userId", async (req, res) => {
  const session = await createSession(req.params.userId);
  res.json({ status: session.status });
});

app.get("/qr/:userId", (req, res) => {
  const s = sessions[req.params.userId];
  res.json({ qr: s?.qr || null, status: s?.status || "offline" });
});

app.get("/status", (req, res) => {
  const users = Object.keys(sessions);
  const status = users.length ? sessions[users[0]].status : "offline";
  res.json({ status });
});

app.post("/join/:userId", async (req, res) => {
  const { invite } = req.body;
  const session = sessions[req.params.userId];
  
  if (!session || session.status !== "ready") {
    return res.status(400).json({ error: "Sessão não iniciada ou não conectada" });
  }

  try {
    const code = invite.split("/").pop();
    await session.client.acceptInvite(code);
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro ao entrar no grupo:", e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint manual de envio (Compatibilidade Dashboard)
app.post("/send/:userId", async (req, res) => {
  const { groupId, message, number } = req.body; // Aceita number (legado) ou groupId
  const target = groupId || number;
  
  const session = sessions[req.params.userId];
  if (!session || session.status !== 'ready') {
    return res.status(400).json({ error: 'Sessão WhatsApp não está pronta.' });
  }
  
  try {
     const chatId = target.includes('@') ? target : `${target}@c.us`;
     await session.client.sendMessage(chatId, message);
     res.json({ok: true});
  } catch(e) {
     res.status(500).json({error: e.message});
  }
});

// Endpoint de Logs (Compatibilidade Dashboard)
app.get("/logs", async (req, res) => {
  try {
    const logs = await db.all("SELECT * FROM disparos ORDER BY data DESC LIMIT 100");
    // Mapeia para o formato esperado pelo frontend
    const formattedLogs = logs.map(l => ({
        id: l.id,
        grupoNome: l.grupo,
        mensagemEnviada: l.mensagem,
        titulo: l.produto,
        enviadoEm: l.data,
        categoria: 'Geral', // Default
        preco: 0, // Simplificação
        linkAfiliado: '#',
        status: 'success'
    }));
    res.json({ ok: true, logs: formattedLogs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ================== CONTROLE PELO PAINEL ==================

app.post("/config", (req, res) => {
  const { tempo, palavra, mensagem } = req.body;
  if (tempo) intervaloMinutos = tempo;
  if (palavra) palavraChave = palavra;
  if (mensagem) mensagemBase = mensagem;
  
  console.log(`⚙️ Config atualizada: Intervalo=${intervaloMinutos}m, Palavra="${palavraChave}"`);
  res.json({ ok: true });
});

app.post("/ativar", (req, res) => {
  if (!autoDisparoAtivo) {
    autoDisparoAtivo = true;
    console.log("🚀 Robô ativado!");
    iniciarDisparo();
  }
  res.json({ ok: true });
});

app.post("/parar", (req, res) => {
  autoDisparoAtivo = false;
  console.log("⏸️ Robô pausado.");
  res.json({ ok: true });
});

// ================== DISPARO AUTOMÁTICO ==================

async function iniciarDisparo() {
  if (!autoDisparoAtivo) return;

  console.log(`🔄 Executando ciclo de disparo... (Palavra: ${palavraChave})`);

  try {
    const oferta = await buscarOfertas(palavraChave);

    const mensagem = mensagemBase
      .replace("{produto}", oferta.productName)
      .replace("{preco}", oferta.priceMin)
      .replace("{link}", oferta.offerLink);

    let sentCount = 0;

    for (let id in sessions) {
      if (sessions[id].status !== "ready") continue;

      const chats = await sessions[id].client.getChats();
      const groups = chats.filter(c => c.isGroup);

      for (let chat of groups) {
        if (!autoDisparoAtivo) break;

        console.log(`📤 Enviando para grupo: ${chat.name}`);
        await chat.sendMessage(mensagem);
        sentCount++;

        await db.run(
          "INSERT INTO disparos (grupo, mensagem, produto) VALUES (?,?,?)",
          [chat.name, mensagem, oferta.productName]
        );

        // ✅ Delay Anti-ban real (20 a 50 segundos)
        const delay = 20000 + Math.random() * 30000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    console.log(`✅ Ciclo finalizado. Enviado para ${sentCount} grupos.`);

  } catch (e) {
    console.error("❌ Erro no ciclo de disparo:", e.message);
  }

  if (autoDisparoAtivo) {
    console.log(`⏳ Próximo ciclo em ${intervaloMinutos} minutos.`);
    setTimeout(iniciarDisparo, intervaloMinutos * 60000);
  }
}

// ================== SERVER ==================

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Achady Online na porta ${PORT}`));
