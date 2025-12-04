import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import QRCode from "qrcode";

const { Client, LocalAuth } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const sessions = {};

function criarSessao(id) {
    if (sessions[id]) return sessions[id];

    const client = new Client({
        restartOnAuthFail: true,
        authStrategy: new LocalAuth({ clientId: "achady-" + id }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ]
        }
    });

    const sessao = { qr: null, status: "loading", client };
    sessions[id] = sessao;

    client.on("qr", async (qr) => {
        sessao.qr = await QRCode.toDataURL(qr);
        sessao.status = "qr";
    });

    client.on("ready", () => {
        sessao.status = "ready";
    });

    client.on("auth_failure", () => {
        sessao.status = "auth-failure";
    });

    client.initialize();

    return sessao;
}

// Rota para iniciar sessão
app.get("/generate-qr/:id", (req, res) => {
    const id = req.params.id;
    criarSessao(id);
    res.json({ ok: true, message: "Sessão iniciada. Busque o QR em /qr/" + id });
});

// Rota para buscar QR
app.get("/qr/:id", (req, res) => {
    const id = req.params.id;
    const sessao = sessions[id];

    if (!sessao) {
        return res.json({ qr: null, status: "no-session" });
    }

    res.json({
        qr: sessao.qr,
        status: sessao.status
    });
});

// Rota para enviar mensagem
app.post("/enviarMensagem", async (req, res) => {
    const { id, grupo, mensagem } = req.body;

    const sessao = sessions[id];
    if (!sessao || sessao.status !== "ready") {
        return res.status(400).json({ error: "Sessão não está pronta" });
    }

    try {
        await sessao.client.sendMessage(grupo, mensagem);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
});

app.get("/", (req, res) => {
    res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

app.listen(3000, () => {
    console.log("🌐 Servidor rodando na porta 3000");
});