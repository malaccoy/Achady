export interface WhatsAppStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_READY';
  qrCode?: string; // Base64 or URL
}

export interface Group {
  id: string;
  name: string;
  link: string;
  active: boolean;
  chatId?: string;
}

export interface AutomationConfig {
  active: boolean;
  intervalMinutes: number;
}

export interface MessageTemplate {
  content: string;
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

export enum Tab {
  STATUS = 'STATUS',
  GROUPS = 'GROUPS',
  AUTOMATION = 'AUTOMATION',
  TEMPLATE = 'TEMPLATE',
  LOGS = 'LOGS',
}
