import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, MessageTemplate, ShopeeConfigResponse } from '../types';

// Helper for JSON requests
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Erro na requisição: ${response.status}`);
  }

  // Some endpoints might return empty body (like 204)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// --- WhatsApp Connection ---

export const getWhatsappStatus = async (): Promise<{ status: string }> => {
  return request<{ status: string }>('/whatsapp/status');
};

export const getWhatsappQR = async (): Promise<{ status: string; qr: string | null }> => {
  return request<{ status: string; qr: string | null }>('/whatsapp/qr');
};

// --- Groups ---

export const getGroups = async (): Promise<Group[]> => {
  try {
    return await request<Group[]>('/groups');
  } catch (e) {
    console.error("Error fetching groups:", e);
    return [];
  }
};

export const addGroup = async (link: string): Promise<Group> => {
  return request<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
};

export const joinGroup = async (id: string): Promise<void> => {
  await request(`/groups/${id}/join`, { method: 'POST' });
};

export const toggleGroup = async (id: string): Promise<void> => {
  await request(`/groups/${id}/toggle`, { method: 'PATCH' });
};

export const deleteGroup = async (id: string): Promise<void> => {
  await request(`/groups/${id}`, { method: 'DELETE' });
};

// --- Automation ---

export const getAutomationConfig = async (): Promise<AutomationConfig> => {
  try {
    return await request<AutomationConfig>('/automation');
  } catch (e) {
    return { active: false, intervalMinutes: 60 };
  }
};

export const setAutomationStatus = async (active: boolean): Promise<void> => {
  await request('/automation/status', {
    method: 'PATCH',
    body: JSON.stringify({ ativo: active }),
  });
};

export const setAutomationInterval = async (minutes: number): Promise<void> => {
  await request('/automation/interval', {
    method: 'PATCH',
    body: JSON.stringify({ intervalMinutes: minutes }),
  });
};

export const runAutomationOnce = async (): Promise<void> => {
  await request('/automation/run-once', { method: 'POST' });
};

export const sendTestMessage = async (): Promise<void> => {
  await request('/test/send', { method: 'POST' });
};

// --- Shopee API ---

export const getShopeeConfig = async (): Promise<ShopeeConfigResponse> => {
  return request<ShopeeConfigResponse>('/shopee/config');
};

export const saveShopeeConfig = async (appId: string, secret: string): Promise<void> => {
  await request('/shopee/config', {
    method: 'POST',
    body: JSON.stringify({ appId, secret }),
  });
};

// --- Template ---

export const getTemplate = async (): Promise<MessageTemplate> => {
  try {
    const res = await request<{ template: string }>('/template');
    return { content: res.template || '' };
  } catch (e) {
    return { content: '' };
  }
};

export const saveTemplate = async (content: string): Promise<void> => {
  await request('/template', {
    method: 'POST',
    body: JSON.stringify({ template: content }),
  });
};

// --- Logs ---

export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    // Backend logs: { when, group, title, price, status, error }
    const backendLogs = await request<any[]>('/logs');
    
    return backendLogs.map((log: any, index: number) => ({
      id: `${log.when}-${index}`,
      timestamp: log.when,
      groupName: log.group || 'Desconhecido',
      productTitle: log.title || 'Sem título',
      price: log.price || '-',
      status: (log.status === 'enviado' ? 'SENT' : 'ERROR') as LogEntry['status'],
      errorMessage: log.error
    })).reverse();
  } catch (e) {
    console.error("Error fetching logs:", e);
    return [];
  }
};