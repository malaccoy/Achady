export interface WhatsAppStatus {
  status: string; // 'disconnected' | 'qr' | 'ready' | 'auth_failure'
  qrCode?: string; // Base64 or URL
}

// Shopee API Sort Types
export enum ShopeeSortType {
  RELEVANCE_DESC = 1,
  ITEM_SOLD_DESC = 2,
  PRICE_DESC = 3,
  PRICE_ASC = 4,
  COMMISSION_DESC = 5
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
  productCatIds?: (number | string)[]; // Shopee product category IDs or names
  sortType?: number; // Sort type: use ShopeeSortType enum (default: ITEM_SOLD_DESC = 2)
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
  INSTAGRAM = 'INSTAGRAM',
}

export interface InstagramStatus {
  connected: boolean;
  igUsername?: string;
  pageId?: string;
  igBusinessId?: string;
  expiresAt?: string;
}