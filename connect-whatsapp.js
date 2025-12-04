// URL do servidor WhatsApp no Render
const API_URL = "https://achady-whatsapp-server.onrender.com";

export async function iniciarConexaoWhatsApp() {
    document.getElementById("statusText").innerText = "Gerando QR..."; // Iniciar sessão
    await fetch(`${API_URL}/generate-qr/1`);

    // Buscar QR
    buscarQRCode();
}

async function buscarQRCode() {
    const res = await fetch(`${API_URL}/qr/1`);
    const data = await res.json();
    
    // Exibir QR
    if (data.status === "qr" && data.qr) {
        document.getElementById("qrImage").src = data.qr;
        document.getElementById("statusText").innerText = "Escaneie o QR com o WhatsApp";
    }

    // Conectado
    if (data.status === "ready") {
        document.getElementById("statusText").innerText = "WhatsApp conectado!";
        return;
    }

    // Continuar buscando
    setTimeout(buscarQRCode, 2000);
}