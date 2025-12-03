
import { db } from './db';
import { OfertaShopee } from '../types';

// Variável interna para armazenar resultados (cache de sessão)
let ofertasShopee: OfertaShopee[] = [];

export const shopeeService = {
  
  buscarOfertasShopee: async (userId: string): Promise<OfertaShopee[]> => {
    // 1. Ler credenciais da tabelaShopee
    const config = db.getShopeeConfig(userId);

    if (!config || !config.apiKey || !config.apiSecret) {
      db.registrarLog(userId, "N/A", "Credenciais da Shopee não configuradas", "erro");
      throw new Error("Credenciais inválidas");
    }

    // 2. Preparar Requisição
    const url = 'https://open-api.affiliate.shopee.com.br/graphql';
    
    const headers = {
      'Content-Type': 'application/json',
      'App-ID': config.apiKey,
      'App-Secret': config.apiSecret
    };

    const query = `
      {
        getOfferList(categoryId: 0, page: 1, size: 20) {
          productName
          offerPrice
          originalPrice
          discount
          image
          offerUrl
        }
      }
    `;

    try {
      // 3. Executar fetch
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const json = await response.json();

      if (json.errors) {
        throw new Error(JSON.stringify(json.errors));
      }

      // 4. Transformar Dados
      // Assumindo que a estrutura de retorno segue o padrão solicitado
      // Nota: A API real pode variar a estrutura dentro de 'data', ajustamos para o solicitado.
      const rawList = json.data?.getOfferList || [];

      const listaEstruturada: OfertaShopee[] = rawList.map((item: any) => ({
        titulo: item.productName || 'Produto sem nome',
        precoPromocional: parseFloat(item.offerPrice) || 0,
        precoOriginal: parseFloat(item.originalPrice) || 0,
        desconto: item.discount || '0%',
        imagem: item.image || '',
        linkAfiliado: item.offerUrl || ''
      }));

      // 5. Salvar na variável interna
      ofertasShopee = listaEstruturada;
      
      console.log("Ofertas atualizadas:", ofertasShopee);
      
      return listaEstruturada;

    } catch (error: any) {
      // 6. Registrar Log de Erro
      console.error("Falha na busca Shopee:", error);
      
      db.registrarLog(
        userId, 
        "N/A", 
        "Erro ao buscar ofertas da Shopee", 
        "erro"
      );

      // Retornar array vazio em caso de erro para não quebrar a UI
      return [];
    }
  },

  // Getter para a variável interna (útil para debug ou uso posterior sem nova requisição)
  getOfertasArmazenadas: () => {
    return ofertasShopee;
  }
};
