import crypto from "crypto";
import axios from "axios";

// NOTE: Substitua pelas suas credenciais reais da Shopee
const APP_ID = "COLE_SUA_APPID_AQUI";
const SECRET = "COLE_SEU_SECRET_AQUI";

export async function buscarOfertas(keyword = "cozinha") {
  // Se as credenciais não estiverem configuradas, retorna um mock para evitar erro
  if (APP_ID.includes("COLE_SUA") || SECRET.includes("COLE_SEU")) {
    console.warn("⚠️ Credenciais Shopee não configuradas em shopee.js. Retornando dados simulados.");
    return {
      productName: "Produto Exemplo (Configure shopee.js)",
      offerLink: "https://shopee.com.br/exemplo",
      commissionRate: "10",
      priceMin: "50.00",
      priceMax: "100.00"
    };
  }

  const payload = JSON.stringify({
    query: `
      query {
        productOfferV2(keyword: "${keyword}", limit: 1) {
          nodes {
            productName
            offerLink
            commissionRate
            priceMin
            priceMax
          }
        }
      }
    `
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const raw = APP_ID + timestamp + payload + SECRET;

  const signature = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
  };

  try {
    const res = await axios.post(
      "https://open-api.affiliate.shopee.com.br/graphql",
      JSON.parse(payload),
      { headers }
    );

    const nodes = res.data.data?.productOfferV2?.nodes;
    if (nodes && nodes.length > 0) {
      return nodes[0];
    }
    throw new Error("Nenhuma oferta encontrada");
  } catch (error) {
    console.error("Erro Shopee API:", error.response?.data || error.message);
    throw error;
  }
}
