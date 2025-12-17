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
  // Category Rotation Settings
  rotationEnabled?: boolean; // Enable automatic category rotation (default: true)
  rotationEmptyThreshold?: number; // Rotate after X consecutive empty results (default: 3)
  rotationCooldownMinutes?: number; // Cooldown per category in minutes (default: 15)
  // Runtime rotation state (read-only, managed by backend)
  rotationState?: CategoryRotationState;
}

export interface CategoryRotationState {
  currentCategoryIndex: number;
  currentPage?: number; // Current page for active category
  currentCategoryId?: number | string; // Active category ID
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
  expired?: boolean;
  limited?: boolean;
  status?: string; // 'connected', 'connected_limited'
  igUsername?: string;
  pageId?: string;
  igBusinessId?: string;
  expiresAt?: string;
}

// Instagram Post from cache
export interface InstagramPost {
  id: string;
  caption?: string;
  mediaType: string;
  mediaUrl?: string;
  permalink?: string;
  timestamp?: string;
}

// Instagram automation rule match types
export type InstagramMatchType = 'CONTAINS' | 'EQUALS' | 'REGEX';

// Instagram automation rule
export interface InstagramRule {
  id: string;
  enabled: boolean;
  matchType: InstagramMatchType;
  keyword: string;
  mediaId?: string | null;
  actionSendDM: boolean;
  actionReplyComment: boolean;
  replyTemplateDM: string;
  replyTemplateComment?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Instagram rule create/update payload
export interface InstagramRulePayload {
  keyword: string;
  matchType: InstagramMatchType;
  mediaId?: string | null;
  actionSendDM: boolean;
  actionReplyComment: boolean;
  replyTemplateDM: string;
  replyTemplateComment?: string | null;
  enabled?: boolean;
}

// Instagram posts response
export interface InstagramPostsResponse {
  posts: InstagramPost[];
  total: number;
}

// Instagram rule test response
export interface InstagramRuleTestMatch {
  ruleId: string;
  keyword: string;
  matchType: InstagramMatchType;
  actionSendDM: boolean;
  actionReplyComment: boolean;
  renderedDM?: string | null;
  renderedComment?: string | null;
}

export interface InstagramRuleTestResponse {
  text: string;
  rulesChecked: number;
  matches: InstagramRuleTestMatch[];
}

// Instagram Auto-Reply MVP Configuration
export interface InstagramAutoReplyConfig {
  enabled: boolean;
  messageTemplate: string;
  igUsername?: string;
}