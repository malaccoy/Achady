const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const AUTH_PATH = process.env.AUTH_PATH || './auth_info';

// Estado em memória
let sock;
let status = 'disconnected'; // disconnected, qr, connecting, connected
let qrCodeString = null;

// Garante que a pasta de autenticação existe
if (!fs.existsSync(AUTH_PATH)) {
    fs.mkdirSync(AUTH_PATH, { recursive: true });
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Achady Bot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            status = 'qr';
            qrCodeString = qr;
            console.log('[BOT] Novo QR Code gerado');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[BOT] Conexão fechada. Reconectar?', shouldReconnect);
            status = 'disconnected';
            qrCodeString = null;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[BOT] Conexão estabelecida!');
            status = 'connected';
            qrCodeString = null;
        } else if (connection === 'connecting') {
            status = 'connecting';
        }
    });
}

// Inicializa
connectToWhatsApp();

// --- API Interna para o Frontend ---

// 1. Status e QR
app.get('/status', async (req, res) => {
    let qrImage = null;
    if (status === 'qr' && qrCodeString) {
        try {
            qrImage = await qrcode.toDataURL(qrCodeString);
        } catch (e) {
            console.error('[BOT] Erro ao gerar imagem QR', e);
        }
    }
    
    res.json({
        status: status === 'connected' ? 'ready' : status, // Mapeando para 'ready' para manter compatibilidade
        qr: qrImage
    });
});

// 2. Enviar Mensagem
app.post('/send', async (req, res) => {
    const { chatId, content } = req.body;

    if (status !== 'connected' || !sock) {
        return res.status(503).json({ error: 'Bot não está conectado.' });
    }

    try {
        // Adiciona sufixo se não vier (aceita apenas números ou JIDs completos)
        const jid = chatId.includes('@') ? chatId : `${chatId}@g.us`; 
        
        await sock.sendMessage(jid, { text: content });
        res.json({ success: true });
    } catch (error) {
        console.error('[BOT] Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Falha ao enviar mensagem.' });
    }
});

// 3. Entrar em Grupo (via Link)
app.post('/join', async (req, res) => {
    const { link } = req.body;
    
    if (status !== 'connected' || !sock) {
        return res.status(503).json({ error: 'Bot não está conectado.' });
    }

    try {
        // Espera formato https://chat.whatsapp.com/CODE
        const code = link.split('https://chat.whatsapp.com/')[1];
        if (!code) {
            return res.status(400).json({ error: 'Link inválido.' });
        }

        const groupJid = await sock.groupAcceptInvite(code);
        res.json({ success: true, chatId: groupJid });
    } catch (error) {
        console.error('[BOT] Erro ao entrar no grupo:', error);
        res.status(500).json({ error: 'Falha ao entrar no grupo. Verifique o link ou se o bot já está nele.' });
    }
});

app.listen(PORT, () => {
    console.log(`[BOT] Serviço rodando na porta ${PORT}`);
});
