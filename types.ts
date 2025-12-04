
// View Models (UI)
export interface WhatsAppGroup {
  id: string;
  link: string;
  name: string;
  category: GroupCategory; // Added
}

export interface AutomationLog {
  id: string;
  timestamp: string;
  groupName: string;
  messageSnippet: string;
  status: 'success' | 'error' | 'info'; 
}

export interface AppSettings {
  shopeeApiKey: string;
  shopeeApiSecret: string;
  shopeeConnected: boolean;
  messageTemplate: string;
  automationEnabled: boolean;
  checkIntervalMinutes: number;
}

export interface User {
  id: string;
  email: string;
}

// Database Models (Tabelas Internas)

export interface TabelaUsuario {
  id: string; // auto
  email: string;
  senhaHash: string;
  dataCriacao: string;
}

export interface TabelaShopee {
  userId: string;
  apiKey: string;
  apiSecret: string;
  status: 'conectado' | 'nao_conectado';
}

export interface TabelaModeloMensagem {
  userId: string;
  modeloTexto: string;
  ultimaAtualizacao: string;
}

// Nova definição de Categorias
export type GroupCategory = 'moda' | 'beleza' | 'casa' | 'esportes' | 'eletronicos' | 'brinquedos' | 'pet' | 'cozinha' | 'geral';

export interface TabelaGrupos {
  idGrupoInterno: string; // auto
  userId: string;
  linkGrupo: string;
  nomeGrupo?: string;
  categoria: GroupCategory; // Novo campo obrigatório
  ativo: boolean; // Novo campo implícito na especificação, default true
  criadoEm: string; // Novo campo
}

export interface TabelaAutomacao {
  userId: string;
  estado: boolean; // ON/OFF
  intervalo: number; // Minutos
}

export interface TabelaLogs {
  id: string; // auto
  userId: string;
  grupo: string;
  mensagem: string;
  status: 'sucesso' | 'erro' | 'formatado';
  dataHora: string;
}

// Estrutura de Oferta Normalizada
export interface OfertaShopee {
  titulo: string;
  precoPromocional: number;
  precoOriginal: number;
  desconto: string;
  imagem: string;
  linkAfiliado: string;
}

// NEW: Server-side Message Log Structure
export interface MessageLog {
  id: string;
  grupoId: string;
  grupoNome: string;
  whatsappLink: string;
  categoria: string;
  produtoId: string;
  titulo: string;
  precoOriginal?: number;
  preco: number;
  descontoPercentual?: number;
  linkAfiliado: string;
  mensagemEnviada: string;
  enviadoEm: string; // ISO String
}