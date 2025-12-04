
import { 
  TabelaUsuario, 
  TabelaShopee, 
  TabelaModeloMensagem, 
  TabelaGrupos, 
  TabelaLogs,
  TabelaAutomacao,
  GroupCategory
} from '../types';

const KEYS = {
  USUARIOS: 'db_usuarios',
  SHOPEE: 'db_shopee',
  MODELOS: 'db_modelos',
  GRUPOS: 'db_grupos',
  AUTOMACAO: 'db_automacao',
  LOGS: 'db_logs',
  SESSION: 'db_session_user_id'
};

// Helper genérico para ler/escrever
const getTable = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setTable = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const db = {
  // --- Sessão & Auth ---
  login: (email: string, senha: string): { success: boolean; userId?: string; error?: string } => {
    const usuarios = getTable<TabelaUsuario>(KEYS.USUARIOS);
    const user = usuarios.find(u => u.email === email && u.senhaHash === senha);
    
    if (user) {
      localStorage.setItem(KEYS.SESSION, user.id);
      return { success: true, userId: user.id };
    }
    return { success: false, error: 'Email ou senha inválidos' };
  },

  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
  },

  getCurrentUserId: (): string | null => {
    return localStorage.getItem(KEYS.SESSION);
  },

  createUser: (email: string, senha: string): { success: boolean; error?: string } => {
    const usuarios = getTable<TabelaUsuario>(KEYS.USUARIOS);
    
    if (usuarios.some(u => u.email === email)) {
      return { success: false, error: 'Email já cadastrado' };
    }

    const newUser: TabelaUsuario = {
      id: Date.now().toString(),
      email,
      senhaHash: senha,
      dataCriacao: new Date().toISOString()
    };

    usuarios.push(newUser);
    setTable(KEYS.USUARIOS, usuarios);
    
    // Inicializar dados padrão
    db.salvarApiKeyShopee(newUser.id, '', '');
    db.alternarAutomacao(newUser.id, false, 15);
    
    // Modelo de Mensagem Atualizado conforme solicitado
    const novoModelo = `🔥 A SHÓ TÁ DEMAISSSS 😭🔥

🎁 {{titulo}}

⚠️ De: R$ {{precoOriginal}}
🔥 Por: R$ {{preco}}

🛒 Compre aqui:
{{link}}

🎫 Cupons disponíveis aqui:
https://s.shopee.com.br/9fDVlcSL5R

*O preço e disponibilidade do produto podem variar, pois as promoções são por tempo limitado.*`;

    db.salvarModeloMensagem(newUser.id, novoModelo);

    return { success: true };
  },

  // --- Funções Internas Solicitadas ---

  // Salva a apiKey na tabelaShopee para o usuário logado. Atualiza status para “conectado”.
  salvarApiKeyShopee: (userId: string, apiKey: string, apiSecret: string) => {
    let table = getTable<TabelaShopee>(KEYS.SHOPEE);
    const index = table.findIndex(r => r.userId === userId);
    
    const status = (apiKey && apiKey.length > 3 && apiSecret && apiSecret.length > 3) ? 'conectado' : 'nao_conectado';
    const record: TabelaShopee = { userId, apiKey, apiSecret, status };

    if (index >= 0) {
      table[index] = record;
    } else {
      table.push(record);
    }
    setTable(KEYS.SHOPEE, table);
  },

  // Recupera config Shopee (auxiliar para UI)
  getShopeeConfig: (userId: string): TabelaShopee | undefined => {
    const table = getTable<TabelaShopee>(KEYS.SHOPEE);
    return table.find(r => r.userId === userId);
  },

  // Atualiza/insere o modelo na tabelaModelosMensagem.
  salvarModeloMensagem: (userId: string, texto: string) => {
    let table = getTable<TabelaModeloMensagem>(KEYS.MODELOS);
    const index = table.findIndex(r => r.userId === userId);
    
    const record: TabelaModeloMensagem = {
      userId,
      modeloTexto: texto,
      ultimaAtualizacao: new Date().toISOString()
    };

    if (index >= 0) {
      table[index] = record;
    } else {
      table.push(record);
    }
    setTable(KEYS.MODELOS, table);
  },

  // Recupera modelo (auxiliar para UI)
  getModelo: (userId: string): TabelaModeloMensagem | undefined => {
    const table = getTable<TabelaModeloMensagem>(KEYS.MODELOS);
    return table.find(r => r.userId === userId);
  },

  // Insere linkGrupo na tabelaGrupos do usuário.
  // ATUALIZADO: Agora aceita categoria
  adicionarGrupoWhatsApp: (userId: string, linkGrupo: string, categoria: GroupCategory) => {
    const table = getTable<TabelaGrupos>(KEYS.GRUPOS);
    const count = table.filter(g => g.userId === userId).length + 1;
    
    const novoGrupo: TabelaGrupos = {
      idGrupoInterno: Date.now().toString(),
      userId,
      linkGrupo,
      nomeGrupo: `Grupo ${count}`,
      categoria: categoria,
      ativo: true,
      criadoEm: new Date().toISOString()
    };
    
    table.push(novoGrupo);
    setTable(KEYS.GRUPOS, table);
    return novoGrupo;
  },

  // Remove o grupo da tabelaGrupos.
  deletarGrupo: (idGrupoInterno: string) => {
    let table = getTable<TabelaGrupos>(KEYS.GRUPOS);
    // Filtra removendo o item que tem o ID correspondente
    table = table.filter(g => g.idGrupoInterno !== idGrupoInterno);
    setTable(KEYS.GRUPOS, table);
  },

  // Recupera grupos (auxiliar para UI)
  getGrupos: (userId: string): TabelaGrupos[] => {
    const table = getTable<TabelaGrupos>(KEYS.GRUPOS);
    // Garante retrocompatibilidade se o campo categoria não existir em registros antigos
    return table
      .filter(r => r.userId === userId)
      .map(g => ({
        ...g,
        categoria: g.categoria || 'geral', // Default fallback
        ativo: g.ativo ?? true,
        criadoEm: g.criadoEm || new Date().toISOString()
      }));
  },

  // Salva na tabelaAutomacao: userId, estado, intervalo
  alternarAutomacao: (userId: string, estado: boolean, intervaloMinutos: number) => {
    let table = getTable<TabelaAutomacao>(KEYS.AUTOMACAO);
    const index = table.findIndex(r => r.userId === userId);

    const record: TabelaAutomacao = {
      userId,
      estado,
      intervalo: intervaloMinutos
    };

    if (index >= 0) {
      table[index] = record;
    } else {
      table.push(record);
    }
    setTable(KEYS.AUTOMACAO, table);
  },

  // Recupera automação (auxiliar para UI)
  getAutomacao: (userId: string): TabelaAutomacao | undefined => {
    const table = getTable<TabelaAutomacao>(KEYS.AUTOMACAO);
    return table.find(r => r.userId === userId);
  },

  // Insere um registro na tabelaLogs.
  registrarLog: (userId: string, grupo: string, mensagem: string, status: 'sucesso' | 'erro' | 'formatado') => {
    const table = getTable<TabelaLogs>(KEYS.LOGS);
    const novoLog: TabelaLogs = {
      id: Date.now().toString(),
      userId,
      grupo,
      mensagem,
      status,
      dataHora: new Date().toISOString()
    };
    table.push(novoLog);
    setTable(KEYS.LOGS, table);
  },

  // Recupera logs (auxiliar para UI)
  getLogs: (userId: string): TabelaLogs[] => {
    const table = getTable<TabelaLogs>(KEYS.LOGS);
    return table
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  }
};
