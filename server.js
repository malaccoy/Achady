import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client, LocalAuth } = pkg;

const app = express();

// ✅ Configuração CORS permissiva para aceitar requisições do Google Studio/Vercel
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir frontend (caso esteja rodando junto)
app.use(express.static(path.join(__dirname, 'dist')));

// Armazenamento em memória
const sessions = {};
const qrCodes = {};

// Função auxiliar para formatar número (remove caracteres não numéricos e garante sufixo @c.us)
function formatPhone(phone) {
    let clean = phone.replace(/\D/g, '');
    if (!clean.endsWith('@c.us')) {
        clean += '@c.us';
    }
    return clean;
}

function createSession(sessionId) {
    if (sessions[sessionId]) return sessions[sessionId];

    console.log(`🟣 Criando sessão ${sessionId}...`);

    const client = new Client({
        restartOnAuthFail: true,
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions"
            ]
        }
    });

    sessions[sessionId] = {
        client,
        status: "starting"
    };

    client.on("qr", async qr => {
        console.log(`📌 Novo QR para sessão ${sessionId}`);
        const image = await QRCode.toDataURL(qr);
        qrCodes[sessionId] = image;
        sessions[sessionId].status = "qr";
    });

    client.on("ready", () => {
        console.log(`✅ Sessão ${sessionId} conectada`);
        sessions[sessionId].status = "connected"; // Ajustado para "connected" conforme pedido
    });

    client.on("authenticated", () => {
        sessions[sessionId].status = "authenticated";
    });

    client.on("auth_failure", () => {
        sessions[sessionId].status = "disconnected";
    });

    client.on("disconnected", () => {
        sessions[sessionId].status = "disconnected";
        console.log(`❌ Sessão ${sessionId} desconectada`);
    });

    client.initialize();
    return sessions[sessionId];
}

// =======================================================
// ✅ ROTAS ETAPA 2 e 3 (CONEXÃO)
// =======================================================

// 1. Iniciar Sessão
app.post("/start/:userId", (req, res) => {
    const { userId } = req.params;
    createSession(userId);
    res.json({ ok: true, message: "Sessão iniciada" });
});

// 2. Buscar QR Code
app.get("/qr/:userId", (req, res) => {
    const { userId } = req.params;
    
    if (!sessions[userId]) {
        return res.json({ status: "disconnected" });
    }

    const sessao = sessions[userId];
    const qrCode = qrCodes[userId];

    if (sessao.status === 'connected') {
        return res.json({ status: 'connected' });
    }

    if (sessao.status === 'qr' && qrCode) {
        return res.json({ status: 'qr', qr: qrCode });
    }

    return res.json({ status: 'starting' });
});

// =======================================================
// ✅ ROTA ETAPA 4 (ENVIO DE MENSAGEM)
// =======================================================

app.post("/send", async (req, res) => {
    const { userId, number, message } = req.body;

    if (!sessions[userId] || sessions[userId].status !== 'connected') {
        return res.status(400).json({ error: "Sessão não conectada ou inexistente" });
    }

    try {
        const chatId = formatPhone(number);
        await sessions[userId].client.sendMessage(chatId, message);
        console.log(`✅ Mensagem enviada para ${number}`);
        res.json({ ok: true, message: "Mensagem enviada com sucesso" });
    } catch (e) {
        console.error("Erro ao enviar mensagem:", e);
        res.status(500).json({ error: "Falha ao enviar mensagem." });
    }
});

// =======================================================
// ✅ ROTA ETAPA 5 (STATUS)
// =======================================================

app.get("/status/:userId", (req, res) => {
    const { userId } = req.params;
    if (!sessions[userId]) {
        return res.json({ status: "disconnected" });
    }
    res.json({ status: sessions[userId].status });
});

// Fallback para React Router
app.get("*", (req, res) => {
    if (req.path.startsWith('/qr/') || req.path.startsWith('/start/') || req.path.startsWith('/send') || req.path.startsWith('/status/')) {
        return res.status(404).json({ error: "Endpoint não encontrado" });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});