import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { inviteLink, category } = req.body;
    const baseUrl = process.env.VPS_WHATSAPP_BASE_URL || 'http://72.60.228.212:3001';

    if (!inviteLink || typeof inviteLink !== 'string') {
      return res.status(400).json({ error: 'inviteLink obrigatório' });
    }

    // 1. Entrar no Grupo na VPS
    const responseJoin = await axios.post(`${baseUrl}/join-group`, {
      inviteLink: inviteLink
    });
    
    const { groupId, groupName } = responseJoin.data;

    if (!groupId) {
        return res.status(500).json({ error: 'VPS não retornou groupId' });
    }

    // 2. Configurar este grupo como o padrão para envio (Automação)
    await axios.post(`${baseUrl}/config/group`, {
        groupId: groupId
    });
    
    // Retorna sucesso para o frontend
    return res.status(200).json({
        success: true,
        groupName,
        groupId,
        category: category || null,
        message: "Grupo adicionado e configurado com sucesso."
    });

  } catch (error) {
    console.error('Erro proxy ADD-GROUP:', error.message);
    const errorMsg = error.response?.data?.error || error.message || 'Erro interno';
    return res.status(500).json({ error: `Erro ao adicionar grupo: ${errorMsg}` });
  }
}
