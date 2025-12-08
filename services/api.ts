import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, MessageTemplate, WhatsAppStatus } from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// --- WhatsApp Connection ---

export const getBotStatus = async (): Promise<WhatsAppStatus> => {
  // Mocking response for demo if API fails/doesn't exist yet
  try {
    const res = await api.get('/whatsapp/status');
    return res.data;
  } catch (error) {
    console.warn("API Error, returning mock status", error);
    return { status: 'DISCONNECTED' };
  }
};

export const generateQrCode = async (): Promise<{ qrCode: string }> => {
  const res = await api.get('/whatsapp/qr');
  return res.data;
};

// --- Groups ---

export const getGroups = async (): Promise<Group[]> => {
  try {
    const res = await api.get('/groups');
    return res.data;
  } catch (e) {
    return [];
  }
};

export const addGroup = async (link: string): Promise<Group> => {
  const res = await api.post('/groups', { link });
  return res.data;
};

export const toggleGroup = async (id: string): Promise<void> => {
  await api.patch(`/groups/${id}/toggle`);
};

export const deleteGroup = async (id: string): Promise<void> => {
  await api.delete(`/groups/${id}`);
};

// --- Automation ---

export const getAutomationConfig = async (): Promise<AutomationConfig> => {
  try {
    const res = await api.get('/automation/config');
    return res.data;
  } catch (e) {
    return { active: false, intervalMinutes: 60 };
  }
};

export const setAutomationStatus = async (active: boolean): Promise<void> => {
  await api.patch('/automation/status', { active });
};

export const setAutomationInterval = async (minutes: number): Promise<void> => {
  await api.patch('/automation/interval', { minutes });
};

export const runAutomationOnce = async (): Promise<void> => {
  await api.post('/automation/run-once');
};

export const sendTestMessage = async (): Promise<void> => {
    await api.post('/test/send');
};

// --- Template ---

export const getTemplate = async (): Promise<MessageTemplate> => {
  try {
    const res = await api.get('/template');
    return res.data;
  } catch (e) {
    return { content: "🔥 Oferta!\n{{titulo}}\n{{link}}" };
  }
};

export const saveTemplate = async (content: string): Promise<void> => {
  await api.post('/template', { content });
};

// --- Logs ---

export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    const res = await api.get('/logs');
    return res.data;
  } catch (e) {
    // Return mock logs if API fails
    return [
      { id: '1', timestamp: new Date().toISOString(), groupName: 'Promoções 1', productTitle: 'Mouse Gamer Logitech', price: 'R$ 150', status: 'SENT' },
      { id: '2', timestamp: new Date(Date.now() - 3600000).toISOString(), groupName: 'Ofertas Top', productTitle: 'Teclado Mecânico', price: 'R$ 200', status: 'ERROR', errorMessage: 'Timeout' },
    ];
  }
};