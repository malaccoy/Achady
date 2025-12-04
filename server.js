import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import QRCode from "qrcode";

const { Client, LocalAuth } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// Armazena sessões e QRs
const sessions = {};
const qrCodes = {};

// =======================================================
// 🟣 Criar ou pegar sessão existente
// =======================================================
function createSession(sessionId) {
    if (sessions[sessionId]) return sessions[sessionId];

    console.log(`🟣 Criando sessão ${sessionId}...`);

    const client = new Client({
        restartOnAuthFail: true,
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            headless: true,
            // Importante para Railway/Docker: usa o Chrome instalado na imagem se a var de ambiente existir
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
// 🔥 ROTA PARA INICIAR SESSÃO
// =======================================================
app.get("/generate-qr/:sessionId", (req, res) => {
    const { sessionId } = req.params;

    createSession(sessionId);

    res.json({
        ok: true,
        message: "Sessão iniciada. Busque o QR em /qr/" + sessionId
    });
});

// =======================================================
// 🔥 ROTA PARA PEGAR QR ATUAL
// =======================================================
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
// 🔥 ROTA PARA ENVIAR MENSAGEM
// =======================================================
app.post("/enviarMensagem", async (req, res) => {
    const { sessionId, grupo, mensagem } = req.body;

    if (!sessions[sessionId]) {
        return res.status(400).json({ error: "Sessão não encontrada" });
    }

    try {
        await sessions[sessionId].client.sendMessage(grupo, mensagem);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Falha ao enviar mensagem." });
    }
});

// =======================================================
// 🌐 TESTE
// =======================================================
app.get("/", (req, res) => {
    res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

// =======================================================
// 🚀 INICIAR SERVIDOR
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});