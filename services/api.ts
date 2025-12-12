import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, ShopeeConfigResponse, SystemDiagnostics } from '../types';

// Helper for making HTTP requests with common config
async function makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
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
    // Redirecionar para login via window.location causava loop infinito.
    // O App.tsx já captura este erro e muda o estado para exibir <Auth />
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

// Helper for API requests (under /api prefix)
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  return makeRequest<T>(url, options);
}

// Helper for auth requests (auth routes are not under /api prefix)
async function authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return makeRequest<T>(endpoint, options);
}

// --- Auth ---

export const login = async (email: string, password: string) => {
    return authRequest<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
};

export const register = async (email: string, password: string, confirmPassword: string) => {
    return authRequest<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, confirmPassword })
    });
};

export const logout = async () => {
    return authRequest('/auth/logout', { method: 'POST' });
};

export const getMe = async () => {
    return authRequest<any>('/auth/me');
};

export const deleteAccount = async (password: string, confirmation: string) => {
    return authRequest('/auth/account', {
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

export const getSystemDiagnostics = async (): Promise<SystemDiagnostics> => {
  return request<SystemDiagnostics>('/system/diagnostics');
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

export const addGroup = async (link: string, category?: string): Promise<Group> => {
  return request<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify({ link, category }),
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

export const sendTestMessage = async (id: string): Promise<{ ok: boolean; productTitle: string }> => {
  return request<{ ok: boolean; productTitle: string }>(`/groups/${id}/test`, { method: 'POST' });
};

// --- Automation ---

export const getAutomationConfig = async (): Promise<AutomationConfig> => {
  try {
    return await request<AutomationConfig>('/automation');
  } catch (e) {
    return { active: false, intervalMinutes: 60, startTime: "07:00", endTime: "23:00" };
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

export const setAutomationTimeWindow = async (startTime: string, endTime: string): Promise<void> => {
  await request('/automation/time-window', {
    method: 'PATCH',
    body: JSON.stringify({ startTime, endTime }),
  });
};

export const runAutomationOnce = async (): Promise<{ ok: boolean; sent: number; errors: number }> => {
  return request<{ ok: boolean; sent: number; errors: number }>('/automation/run-once', { method: 'POST' });
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