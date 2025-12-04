
import { MessageLog } from '../types';

/**
 * SQL SCHEMA DEFINITION (PostgreSQL):
 * 
 * CREATE TABLE message_logs (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   grupo_id VARCHAR(255) NOT NULL,
 *   grupo_nome VARCHAR(255) NOT NULL,
 *   whatsapp_link TEXT NOT NULL,
 *   categoria VARCHAR(50) NOT NULL,
 *   produto_id VARCHAR(255) NOT NULL,
 *   titulo TEXT NOT NULL,
 *   preco_original DECIMAL(10, 2),
 *   preco DECIMAL(10, 2) NOT NULL,
 *   desconto_percentual DECIMAL(5, 2),
 *   link_afiliado TEXT NOT NULL,
 *   mensagem_enviada TEXT NOT NULL,
 *   enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 */

// In-memory storage simulation for Vercel Serverless
// NOTE: This will reset when the lambda creates a new instance. 
// In production, replace the contents of functions below with real SQL queries.
let MEMORY_LOGS: MessageLog[] = [];

// Seed with some dummy data for UI testing if empty
if (MEMORY_LOGS.length === 0) {
    MEMORY_LOGS.push({
        id: 'mock-uuid-1',
        grupoId: 'grp_01',
        grupoNome: 'Ofertas Moda VIP',
        whatsappLink: 'https://chat.whatsapp.com/ExemploLink',
        categoria: 'moda',
        produtoId: 'shp_12345',
        titulo: 'Vestido Longo Floral Verão 2025',
        precoOriginal: 129.90,
        preco: 89.90,
        descontoPercentual: 31,
        linkAfiliado: 'https://shope.ee/fake-link',
        mensagemEnviada: 'Oferta imperdível...',
        enviadoEm: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 mins ago
    });
}

export async function saveMessageLog(logData: Omit<MessageLog, 'id'>): Promise<string> {
    const newId = crypto.randomUUID();
    
    const newRecord: MessageLog = {
        id: newId,
        ...logData
    };

    // Simulate Insert
    MEMORY_LOGS.unshift(newRecord); // Add to top
    
    // Keep memory clean (limit 100 items)
    if (MEMORY_LOGS.length > 100) MEMORY_LOGS.pop();

    console.log(`[DB] Log saved for product: ${logData.titulo} in group: ${logData.grupoNome}`);
    return newId;
}

export async function getMessageLogs(): Promise<MessageLog[]> {
    // Simulate Select * from message_logs order by enviadoEm desc
    return MEMORY_LOGS.sort((a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime());
}
