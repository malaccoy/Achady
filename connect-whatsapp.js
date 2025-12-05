// URL do servidor WhatsApp na VPS (HTTP)
const API_BASE_URL = "http://72.60.228.212:3000";

export async function iniciarConexaoWhatsApp() {
    const statusText = document.getElementById("statusText");
    if(statusText) statusText.innerText = "Gerando QR..."; 

    // 1. Iniciar sessão (POST /start/1)
    await fetch(`${API_BASE_URL}/start/1`, {
        method: "POST"
    });

    // 2. Buscar QR
    buscarQRCode();
}

async function buscarQRCode() {
    // 3. Polling do QR (GET /qr/1)
    const res = await fetch(`${API_BASE_URL}/qr/1`);
    const data = await res.json();
    
    // Exibir QR
    if (data.status === "qr" && data.qr) {
        const qrImage = document.getElementById("qrImage");
        const statusText = document.getElementById("statusText");
        
        if(qrImage) qrImage.src = data.qr;
        if(statusText) statusText.innerText = "Escaneie o QR com o WhatsApp";
    }

    // Conectado
    if (data.status === "connected" || data.status === "ready") {
        const statusText = document.getElementById("statusText");
        if(statusText) statusText.innerText = "WhatsApp conectado!";
        return;
    }

    // Continuar buscando
    setTimeout(buscarQRCode, 2000);
}