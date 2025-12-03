
// View Models (UI)
export interface WhatsAppGroup {
  id: string;
  link: string;
  name: string;
}

export interface AutomationLog {
  id: string;
  timestamp: string;
  groupName: string;
  messageSnippet: string;
  status: 'success' | 'error' | 'info'; // Adicionado 'info' para preview/formatado
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

export interface TabelaGrupos {
  idGrupoInterno: string; // auto
  userId: string;
  linkGrupo: string;
  // Extra field for UI display
  nomeGrupo?: string; 
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
  status: 'sucesso' | 'erro' | 'formatado'; // Adicionado 'formatado'
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
