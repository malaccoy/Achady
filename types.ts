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
  category?: string;
  lastMessageSent?: string; // ISO date string
  // Shopee productOfferV2 API parameters
  productCatIds?: number[]; // Shopee product category IDs
  sortType?: number; // Sort type: 1=RELEVANCE, 2=ITEM_SOLD, 3=PRICE_DESC, 4=PRICE_ASC, 5=COMMISSION (default: 2)
  minDiscountPercent?: number | null; // Filter: minimum discount percentage (0-100)
  minRating?: number | null; // Filter: minimum rating (0.0-5.0)
  minSales?: number | null; // Filter: minimum sales count
}

export interface AutomationConfig {
  active: boolean;
  intervalMinutes: number;
  startTime: string;
  endTime: string;
  scheduleEnabled: boolean;
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