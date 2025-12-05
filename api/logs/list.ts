import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMessageLogs } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Garantir que é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    // Busca registros ordenados por enviadoEm DESC (já tratado no helper)
    const logs = await getMessageLogs();
    
    return res.status(200).json({
      ok: true,
      logs: logs
    });

  } catch (error: any) {
    console.error('Error fetching logs:', error);
    
    return res.status(500).json({
      ok: false,
      error: error.message || 'Erro interno ao buscar logs.'
    });
  }
}