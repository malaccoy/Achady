import crypto from "crypto";
import axios from "axios";
import * as cheerio from "cheerio";

// URL base para scraping se a API falhar
const SHOPEE_SEARCH_URL = process.env.SHOPEE_URL || "https://shopee.com.br/search?keyword=";

/**
 * Busca ofertas usando a API Oficial de Afiliados da Shopee.
 * Requer APP_ID e SECRET válidos.
 */
async function buscarOfertasAPI(keyword, appId, secret) {
  if (!appId || !secret || appId.includes("COLE_") || secret.includes("COLE_")) {
    return null; // Credenciais inválidas, força fallback
  }

  const payload = JSON.stringify({
    query: `
      query {
        productOfferV2(keyword: "${keyword}", page: 1, limit: 5, sortType: 2) {
          nodes {
            productName
            offerLink
            priceMin
            priceMax
            priceDiscountRate
            imageUrl
          }
        }
      }
    `
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const raw = appId + timestamp + payload + secret;
  const signature = crypto.createHash("sha256").update(raw).digest("hex");

  try {
    const res = await axios.post(
      "https://open-api.affiliate.shopee.com.br/graphql",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
        },
        timeout: 5000
      }
    );

    const nodes = res.data?.data?.productOfferV2?.nodes;
    if (nodes && nodes.length > 0) {
      console.log(`✅ [Shopee API] Encontradas ${nodes.length} ofertas.`);
      return nodes;
    }
  } catch (error) {
    console.warn(`⚠️ [Shopee API] Falha: ${error.message}. Tentando scraping...`);
  }
  return null;
}

/**
 * Busca ofertas fazendo Scraping da página de busca da Shopee.
 * Usado como fallback quando a API não está configurada.
 */
async function buscarOfertasScraper(keyword) {
  console.log(`🕷️ [Shopee Scraper] Buscando por: "${keyword}"`);
  
  try {
    const url = `${SHOPEE_SEARCH_URL}${encodeURIComponent(keyword)}`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    const ofertas = [];

    // Tenta extrair dados do JSON-LD (Método mais confiável)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json['@type'] === 'Product' || json['@type'] === 'ProductGroup') {
             ofertas.push({
               productName: json.name,
               offerLink: json.url || url, // Link pode não ser direto de afiliado no scraper
               priceMin: json.offers?.price || json.offers?.lowPrice,
               priceMax: json.offers?.highPrice || json.offers?.price,
               priceDiscountRate: 0, 
               imageUrl: json.image
             });
        }
      } catch (e) { /* ignore parse errors */ }
    });

    // Se o JSON-LD falhar, fallback para seletores CSS (Frágil, a Shopee muda classes constantemente)
    if (ofertas.length === 0) {
      // Nota: Seletores são exemplos e podem precisar de ajuste constante
      $('div[data-sqe="item"]').slice(0, 5).each((_, el) => {
         const titulo = $(el).find('div[data-sqe="name"]').text().trim();
         const preco = $(el).find('span.text-brand-primary').text().trim().replace('R$', '');
         const link = $(el).find('a').attr('href');
         
         if (titulo && link) {
           ofertas.push({
             productName: titulo,
             offerLink: `https://shopee.com.br${link}`,
             priceMin: parseFloat(preco) || 0,
             priceMax: parseFloat(preco) || 0,
             priceDiscountRate: 0,
             imageUrl: ""
           });
         }
      });
    }

    if (ofertas.length > 0) {
        console.log(`✅ [Shopee Scraper] Encontradas ${ofertas.length} ofertas via HTML.`);
        return ofertas;
    }

  } catch (err) {
    console.error(`❌ [Shopee Scraper] Erro: ${err.message}`);
  }

  // MOCK DE ULTIMO RECURSO (Para o MVP não parar)
  console.log("⚠️ [Shopee] Nenhum dado real obtido. Retornando oferta simulada.");
  return [{
    productName: `Oferta Teste: ${keyword}`,
    priceMin: 49.90,
    priceMax: 99.90,
    priceDiscountRate: 50,
    offerLink: "https://shopee.com.br/daily_discover",
    imageUrl: ""
  }];
}

/**
 * Função Principal exportada
 */
export async function buscarOfertas(keyword = "ofertas", config = {}) {
  // 1. Tenta API Oficial
  const ofertasAPI = await buscarOfertasAPI(keyword, config.appId, config.appSecret);
  if (ofertasAPI) return ofertasAPI;

  // 2. Fallback para Scraper
  return await buscarOfertasScraper(keyword);
}

// Alias para satisfazer o requisito do whatsapp-server.js
export const buscarOfertasShopee = buscarOfertas;