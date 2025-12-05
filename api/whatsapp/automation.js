import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { status, intervalMinutes } = req.body;
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';

    const response = await axios.post(`${baseUrl}/automation`, {
      status: status,
      intervalMinutes: intervalMinutes 
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy AUTOMATION:', error.message);
    return res.status(500).json({ error: 'Erro ao alterar automação na VPS' });
  }
}
