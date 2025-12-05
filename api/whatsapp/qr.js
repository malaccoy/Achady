import axios from 'axios';
import QRCode from 'qrcode';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // URL da VPS onde roda o whatsapp-server.js
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';
    
    // Busca o QR code bruto (string) e o status na VPS
    const response = await axios.get(`${baseUrl}/qr`);
    const { qr, status } = response.data;

    let imageUrl = null;

    // Se houver um código QR (string), converte para imagem Base64
    if (qr && typeof qr === 'string') {
      try {
        imageUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error('Erro ao gerar imagem do QR:', err);
      }
    }

    // Retorna para o frontend a imagem pronta e o status
    return res.status(200).json({ 
      imageUrl, 
      status 
    });

  } catch (error) {
    console.error('Erro proxy QR:', error.message);
    if (error.response) {
       return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ error: 'Erro ao buscar ou gerar QR' });
  }
}