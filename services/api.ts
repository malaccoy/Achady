import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, ShopeeConfigResponse } from '../types';

// Helper for JSON requests
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // IMPORTANTE: Envia cookies HttpOnly
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Redirecionar para login causava loop infinito. 
    // O App.tsx já lida com o estado de deslogado ao capturar este erro.
    throw new Error('Não autorizado');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Erro na requisição: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// --- Auth ---

export const login = async (email: string, password: string) => {
    return request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
};

export const register = async (email: string, password: string, confirmPassword: string) => {
    return request<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, confirmPassword })
    });
};

export const logout = async () => {
    return request('/auth/logout', { method: 'POST' });
};

export const getMe = async () => {
    return request<any>('/auth/me');
};

export const deleteAccount = async (password: string, confirmation: string) => {
    return request('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password, confirmation })
    });
};

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

export const updateGroup = async (id: string, data: Partial<Group>): Promise<Group> => {
  return request<Group>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
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

export const testShopeeConnection = async (): Promise<any> => {
  return request('/shopee/test', { method: 'POST' });
};

// --- Template ---

export const getTemplate = async (): Promise<{ template: string }> => {
  return request<{ template: string }>('/template');
};

export const saveTemplate = async (template: string): Promise<void> => {
  await request('/template', {
    method: "POST",
    body: JSON.stringify({ template }),
  });
};

export const sendTestOffer = async (): Promise<void> => {
  await request('/test/send', { method: "POST" });
};

// --- Logs ---

export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    const backendLogs = await request<any[]>('/logs');
    
    return backendLogs.map((log: any, index: number) => {
      let status: LogEntry['status'] = 'ERROR';
      if (log.status === 'SENT' || log.status === 'enviado') {
        status = 'SENT';
      } else if (log.status === 'PENDING') {
        status = 'PENDING';
      }

      return {
        id: log.id || `${log.timestamp}-${index}`,
        timestamp: log.timestamp,
        groupName: log.groupName || 'Desconhecido',
        productTitle: log.productTitle || 'Sem título',
        price: log.price || '-',
        status: status,
        errorMessage: log.errorMessage
      };
    }).reverse();
  } catch (e) {
    console.error("Error fetching logs:", e);
    return [];
  }
};