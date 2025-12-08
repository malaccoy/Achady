import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, MessageTemplate, WhatsAppStatus, ShopeeConfigResponse } from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Helper to map backend status to frontend status
const mapStatus = (s: string): WhatsAppStatus['status'] => {
  switch (s) {
    case 'ready': return 'CONNECTED';
    case 'qr': return 'QR_READY';
    case 'auth_failure': return 'DISCONNECTED';
    case 'disconnected': return 'DISCONNECTED';
    default: return 'DISCONNECTED';
  }
};

// --- WhatsApp Connection ---

export const getBotStatus = async (): Promise<WhatsAppStatus> => {
  try {
    const res = await api.get('/whatsapp/status');
    return { status: mapStatus(res.data.status) };
  } catch (error) {
    console.warn("API Error", error);
    return { status: 'DISCONNECTED' };
  }
};

export const generateQrCode = async (): Promise<WhatsAppStatus> => {
  const res = await api.get('/whatsapp/qr');
  return { 
    status: mapStatus(res.data.status),
    qrCode: res.data.qr 
  };
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

export const joinGroup = async (id: string): Promise<void> => {
  await api.post(`/groups/${id}/join`);
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
    const res = await api.get('/automation');
    return res.data;
  } catch (e) {
    return { active: false, intervalMinutes: 60 };
  }
};

export const setAutomationStatus = async (active: boolean): Promise<void> => {
  await api.patch('/automation/status', { ativo: active });
};

export const setAutomationInterval = async (minutes: number): Promise<void> => {
  await api.patch('/automation/interval', { intervalMinutes: minutes });
};

export const runAutomationOnce = async (): Promise<void> => {
  await api.post('/automation/run-once');
};

export const sendTestMessage = async (): Promise<void> => {
    await api.post('/test/send');
};

// --- Shopee API ---

export const getShopeeConfig = async (): Promise<ShopeeConfigResponse> => {
  const res = await api.get('/shopee/config');
  return res.data;
};

export const saveShopeeConfig = async (appId: string, secret: string): Promise<void> => {
  await api.post('/shopee/config', { appId, secret });
};


// --- Template ---

export const getTemplate = async (): Promise<MessageTemplate> => {
  try {
    const res = await api.get('/template');
    return { content: res.data.template || '' };
  } catch (e) {
    return { content: '' };
  }
};

export const saveTemplate = async (content: string): Promise<void> => {
  await api.post('/template', { template: content });
};

// --- Logs ---

export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    const res = await api.get('/logs');
    // Map backend logs to frontend interface
    // Backend: { when, group, title, price, status, error }
    return res.data.map((log: any, index: number) => ({
      id: `${log.when}-${index}`,
      timestamp: log.when,
      groupName: log.group || 'Desconhecido',
      productTitle: log.title || 'Sem título',
      price: log.price || '-',
      status: log.status === 'enviado' ? 'SENT' : 'ERROR',
      errorMessage: log.error
    })).reverse(); // Show newest first if backend sends oldest first
  } catch (e) {
    return [];
  }
};