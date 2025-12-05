import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';
    
    // Busca status na VPS
    const response = await axios.get(`${baseUrl}/status`, { timeout: 5000 });
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy STATUS:', error.message);
    // Retorna um status default "offline" se a VPS estiver inacessível
    return res.status(200).json({ 
        connected: false, 
        shopeeConfigured: false, 
        groupConfigured: false,
        error: "VPS Unreachable"
    });
  }
}