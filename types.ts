export interface WhatsAppStatus {
  status: string; // 'disconnected' | 'qr' | 'ready' | 'auth_failure'
  qrCode?: string; // Base64 or URL
}

export interface Group {
  id: string;
  name: string;
  link: string;
  active: boolean;
  chatId?: string;
  keywords?: string[];
  negativeKeywords?: string[];
}

export interface AutomationConfig {
  active: boolean;
  intervalMinutes: number;
}

export interface MessageTemplate {
  id?: string;
  name: string;
  content: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSettings {
  activeTemplateId?: string;
  signature?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  groupName: string;
  productTitle: string;
  price: string;
  status: 'SENT' | 'ERROR' | 'PENDING';
  errorMessage?: string;
}

export interface ShopeeConfigResponse {
  hasCredentials: boolean;
  appIdMasked: string | null;
}

export interface SystemDiagnostics {
  whatsappConnected: boolean;
  shopeeConfigured: boolean;
  automationActive: boolean;
  lastMessageSent: {
    timestamp: string;
    groupName: string;
  } | null;
  lastStatusCheck: string;
}

export enum Tab {
  STATUS = 'STATUS',
  GROUPS = 'GROUPS',
  AUTOMATION = 'AUTOMATION',
  TEMPLATE = 'TEMPLATE',
  LOGS = 'LOGS',
  SHOPEE = 'SHOPEE',
}