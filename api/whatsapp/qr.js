import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';
    
    // Chama o endpoint /qr da VPS que retorna { qr, status }
    const response = await axios.get(`${baseUrl}/qr`);
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy QR:', error.message);
    if (error.response) {
       return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ error: 'Erro ao buscar QR na VPS' });
  }
}
