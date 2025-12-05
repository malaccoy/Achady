// O novo servidor (whatsapp-server.js) roda continuamente.
// Este endpoint serve apenas para manter compatibilidade com o frontend
// que espera um "sucesso" ao clicar em conectar para começar a fazer polling do QR.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Retorna sucesso imediato para o modal avançar para o estado de buscar QR
  return res.status(200).json({ 
    message: "Servidor VPS ativo. Verifique o QR Code.",
    status: "starting" 
  });
}