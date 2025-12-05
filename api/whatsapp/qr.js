import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Usa a variável de ambiente ou fallback para o IP fixo conhecido (porta 3001)
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';
    
    // Chama o endpoint /qr do whatsapp-server.js
    const response = await axios.get(`${baseUrl}/qr`);
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy QR:', error.message);
    // Se der 404 lá (QR não gerado ou já conectado), repassa
    if (error.response) {
       return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ error: 'Erro ao buscar QR na VPS' });
  }
}