import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { number, message } = req.body;
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';

    // O whatsapp-server.js espera { to, message }
    // O frontend manda { number, message }
    const payload = {
      to: number,
      message: message
    };

    const response = await axios.post(`${baseUrl}/send-message`, payload);
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy SEND:', error.message);
    return res.status(500).json({ error: 'Erro ao enviar mensagem via VPS' });
  }
}