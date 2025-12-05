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

// ✅ Configuração CORS permissiva
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ Middleware de LOG (Para ver se as requisições chegam)
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
});

// Servir frontend
app.use(express.static(path.join(__dirname, 'dist')));

const sessions = {};
const qrCodes = {};

// Função auxiliar
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
        sessions[sessionId].status = "connected";
    });

    client.on("authenticated", () => {
        console.log(`✅ Sessão ${sessionId} autenticada (aguardando ready)`);
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
// ✅ ROTAS API
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
    
    // 🔴 Caso 1: Sessão não existe
    if (!sessions[userId]) {
        return res.json({ 
            status: "disconnected", 
            message: "Sessão não encontrada" 
        });
    }

    const sessao = sessions[userId];
    const qrCode = qrCodes[userId];

    // ✅ Caso 2: Conectado
    if (sessao.status === 'connected') {
        return res.json({ status: 'connected', message: "WhatsApp conectado e pronto." });
    }
    
    // 🟡 Caso 3: Autenticado, mas carregando chats
    if (sessao.status === 'authenticated') {
        return res.json({ status: 'authenticated', message: "Autenticado. Carregando conversas..." });
    }

    // 🟣 Caso 4: QR Code disponível
    if (sessao.status === 'qr' && qrCode) {
        return res.json({ status: 'qr', qr: qrCode, message: "Aguardando leitura do QR Code." });
    }

    // ⚪ Caso 5: Iniciando
    return res.json({ status: 'starting', message: "Iniciando cliente WhatsApp..." });
});

// 3. Enviar Mensagem
app.post("/send", async (req, res) => {
    const { userId, number, message } = req.body;

    // 🔴 Erro: Sessão não existe
    if (!sessions[userId]) {
        return res.status(404).json({ 
            ok: false, 
            error: "Sessão não encontrada", 
            details: "Inicie a conexão no painel antes de enviar mensagens." 
        });
    }

    // 🔴 Erro: Sessão existe, mas não está 'connected'
    if (sessions[userId].status !== 'connected') {
        return res.status(400).json({ 
            ok: false, 
            error: "Sessão não está pronta", 
            details: `Status atual: ${sessions[userId].status}. Aguarde a conexão completar.`
        });
    }

    try {
        const chatId = formatPhone(number);
        await sessions[userId].client.sendMessage(chatId, message);
        console.log(`✅ Mensagem enviada para ${number}`);
        res.json({ ok: true, message: "Mensagem enviada com sucesso" });
    } catch (e) {
        console.error("Erro ao enviar mensagem:", e);
        res.status(500).json({ ok: false, error: "Falha interna ao enviar mensagem.", details: e.message });
    }
});

// 4. Status por Usuario
app.get("/status/:userId", (req, res) => {
    const { userId } = req.params;
    if (!sessions[userId]) {
        return res.json({ status: "disconnected" });
    }
    res.json({ status: sessions[userId].status });
});

// ===============================
// ✅ ROTA DE STATUS (OBRIGATÓRIA)
// ===============================
app.get("/status", (req, res) => {
    const ativo = Object.keys(sessions).length > 0;
    res.json({
        status: ativo ? "connected" : "not_connected",
        sessions: Object.keys(sessions)
    });
});

// Fallback
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