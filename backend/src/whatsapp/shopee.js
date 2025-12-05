// src/whatsapp/shopee.js
const axios = require('axios');
const cheerio = require('cheerio');

async function buscarOfertasShopee() {
  const url = process.env.SHOPEE_URL || 'https://shopee.com.br/search?keyword=ofertas';
  const ofertas = [];

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);

    // Ajustar seletores conforme HTML atual da Shopee
    $('.shopee-search-item-result__item').each((_, el) => {
      const titulo = $(el).find('.yQmmFK').text().trim();
      const preco = $(el).find('.WUFI0z').first().text().trim();
      const precoOriginal = $(el).find('.rNlu3Z').text().trim();
      const desconto = $(el).find('.percent').text().trim();
      const link = 'https://shopee.com.br' + $(el).find('a').attr('href');

      if (titulo && preco && link) {
        ofertas.push({
          titulo,
          preco,
          precoOriginal: precoOriginal || '',
          desconto: desconto || '',
          link,
        });
      }
    });

    return ofertas;
  } catch (err) {
    console.error('Erro ao buscar ofertas da Shopee:', err.message);
    return [];
  }
}

module.exports = { buscarOfertasShopee };