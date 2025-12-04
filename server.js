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
app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(path.join(__dirname, 'dist')));

const sessions = {};
const qrCodes = {};

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
        sessions[sessionId].status = "ready";
    });

    client.on("authenticated", () => {
        sessions[sessionId].status = "authenticated";
    });

    client.on("auth_failure", () => {
        sessions[sessionId].status = "auth_failure";
    });

    client.initialize();
    return sessions[sessionId];
}

// =======================================================
// 🔥 ROTAS SOLICITADAS PELO SNIPPET (GOOGLE STUDIO)
// =======================================================

// 1. Iniciar Sessão
app.post("/start/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    createSession(sessionId);
    // Retorno simplificado conforme solicitado:
    res.json({ ok: true });
});

// 2. Buscar QR Code
app.get("/qr/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessions[sessionId]) {
        return res.json({ qr: null, status: "no-session" });
    }

    res.json({
        qr: qrCodes[sessionId] || null,
        status: sessions[sessionId].status
    });
});

// =======================================================

// Rota legado de compatibilidade
app.get("/generate-qr/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    createSession(sessionId);
    res.json({ ok: true, message: "Sessão iniciada." });
});

app.post("/enviarMensagem", async (req, res) => {
    const { sessionId, grupo, mensagem } = req.body;
    if (!sessions[sessionId]) return res.status(400).json({ error: "Sessão não encontrada" });
    try {
        await sessions[sessionId].client.sendMessage(grupo, mensagem);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Falha ao enviar mensagem." });
    }
});

app.get("*", (req, res) => {
    if (req.path.startsWith('/qr/') || req.path.startsWith('/start/') || req.path.startsWith('/enviarMensagem')) {
        return res.status(404).json({ error: "Endpoint não encontrado" });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});