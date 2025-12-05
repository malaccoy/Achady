import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { inviteLink, category } = req.body;
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';

    const response = await axios.post(`${baseUrl}/join-group`, {
      inviteLink: inviteLink
    });
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro proxy JOIN:', error.message);
    return res.status(500).json({ error: 'Erro ao entrar no grupo via VPS' });
  }
}
