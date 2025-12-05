import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { inviteLink, category } = req.body;
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';

    // 1. Entrar no Grupo na VPS
    const responseJoin = await axios.post(`${baseUrl}/join-group`, {
      inviteLink: inviteLink
    });
    
    const { groupId, groupName } = responseJoin.data;

    // 2. Configurar este grupo como o padrão para envio (Automação)
    if (groupId) {
        await axios.post(`${baseUrl}/config/group`, {
            groupId: groupId
        });
    }
    
    // Retorna sucesso para o frontend
    return res.status(200).json({
        success: true,
        groupName,
        groupId,
        message: "Grupo adicionado e configurado com sucesso."
    });

  } catch (error) {
    console.error('Erro proxy JOIN/CONFIG:', error.message);
    const errorMsg = error.response?.data?.error || error.message || 'Erro interno';
    return res.status(500).json({ error: `Erro ao adicionar grupo: ${errorMsg}` });
  }
}