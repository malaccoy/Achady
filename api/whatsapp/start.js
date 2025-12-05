export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }
  // Retorna sucesso imediato para o modal avançar para o estado de buscar QR
  // O servidor na VPS já está rodando.
  return res.status(200).json({ 
    message: "Conexão iniciada.",
    status: "starting" 
  });
}
