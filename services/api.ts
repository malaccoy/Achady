import { API_BASE_URL } from '../constants';
import { Group, LogEntry, AutomationConfig, ShopeeConfigResponse, SystemDiagnostics, MessageTemplate } from '../types';

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

export const getTemplates = async (): Promise<MessageTemplate[]> => {
  try {
    return await request<MessageTemplate[]>('/templates');
  } catch (e) {
    console.error("Error fetching templates:", e);
    return [];
  }
};

export const getTemplate = async (id?: string): Promise<MessageTemplate | null> => {
  try {
    if (id) {
      return await request<MessageTemplate>(`/templates/${id}`);
    }
    // Get active template
    const activeTemplate = await request<MessageTemplate>('/templates/active');
    return activeTemplate;
  } catch (e) {
    console.error("Error fetching template:", e);
    return null;
  }
};

export const createTemplate = async (name: string, content: string): Promise<MessageTemplate> => {
  return request<MessageTemplate>('/templates', {
    method: "POST",
    body: JSON.stringify({ name, content }),
  });
};

export const updateTemplate = async (id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate> => {
  return request<MessageTemplate>(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await request(`/templates/${id}`, { method: "DELETE" });
};

export const setActiveTemplate = async (id: string): Promise<void> => {
  await request('/templates/active', {
    method: "POST",
    body: JSON.stringify({ templateId: id }),
  });
};

export const getSignature = async (): Promise<{ signature: string }> => {
  try {
    return await request<{ signature: string }>('/settings/signature');
  } catch (e) {
    return { signature: '' };
  }
};

export const saveSignature = async (signature: string): Promise<void> => {
  await request('/settings/signature', {
    method: "POST",
    body: JSON.stringify({ signature }),
  });
};

// Legacy template support - will be deprecated
export const getLegacyTemplate = async (): Promise<{ template: string }> => {
  return request<{ template: string }>('/template');
};

export const saveLegacyTemplate = async (template: string): Promise<void> => {
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