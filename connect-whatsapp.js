// URL do servidor WhatsApp na VPS (HTTP)
const API_BASE_URL = "http://72.60.228.212:3000";

export async function iniciarConexaoWhatsApp() {
    const statusText = document.getElementById("statusText");
    if(statusText) statusText.innerText = "Gerando QR..."; 

    // 1. Iniciar sessão (POST /start/1)
    try {
        await fetch(`${API_BASE_URL}/start/1`, {
            method: "POST"
        });
    } catch (e) {
        console.error("Erro ao iniciar sessão:", e);
        if(statusText) statusText.innerText = "Erro ao iniciar. Tente novamente.";
        return;
    }

    // 2. Buscar QR
    buscarQRCode();
}

async function buscarQRCode() {
    try {
        // 3. Polling do QR (GET /qr/1)
        const res = await fetch(`${API_BASE_URL}/qr/1`);
        const data = await res.json();
        
        // Intervalo Base
        let pollInterval = 2000; 

        // --- Lógica de Polling Adaptativo ---

        // 1. STARTING: Servidor abrindo navegador (Demora) -> Diminui frequência para economizar recursos
        if (data.status === "starting") {
            pollInterval = 3000; // 3 segundos
            const statusText = document.getElementById("statusText");
            if(statusText) statusText.innerText = "Iniciando servidor WhatsApp...";
        } 
        
        // 2. QR CODE NA TELA: Usuário vai escanear -> Aumenta frequência para resposta instantânea
        else if (data.status === "qr" && data.qr) {
            pollInterval = 1000; // 1 segundo (rápido)
            
            const qrImage = document.getElementById("qrImage");
            const statusText = document.getElementById("statusText");
            
            // Só atualiza o src se for diferente para evitar piscar
            if(qrImage && qrImage.getAttribute('src') !== data.qr) {
                qrImage.src = data.qr;
            }
            if(statusText) statusText.innerText = "Escaneie o QR com o WhatsApp";
        }

        // 3. AUTENTICADO: Leu o QR, carregando chats -> Frequência média
        else if (data.status === "authenticated") {
            pollInterval = 1500;
            const statusText = document.getElementById("statusText");
            if(statusText) statusText.innerText = "QR Lido! Finalizando conexão...";
        }

        // 4. CONECTADO: Sucesso -> Para o loop
        if (data.status === "connected" || data.status === "ready") {
            const statusText = document.getElementById("statusText");
            if(statusText) statusText.innerText = "WhatsApp conectado! ✅";
            return; // FIM DO POLLING
        }

        // Recursão com o intervalo calculado dinamicamente
        setTimeout(buscarQRCode, pollInterval);

    } catch (error) {
        console.error("Erro no polling:", error);
        // Em caso de erro de rede, espera mais tempo antes de tentar de novo (Backoff)
        setTimeout(buscarQRCode, 4000);
    }
}