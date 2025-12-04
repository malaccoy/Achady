export default async function handler(request: any, response: any) {
  try {
    console.log("Endpoint /api/runShopeeCollector acionado.");

    // 6. Placeholder para a função real do coletor da Shopee
    // TODO: Adicionar lógica do shopeeService aqui futuramente

    // 4. Resposta JSON confirmando execução
    return response.status(200).json({
      message: "runShopeeCollector executado",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 5. Tratamento de erro com console.error
    console.error("Erro ao executar runShopeeCollector:", error);
    
    return response.status(500).json({
      error: "Erro interno no servidor ao executar coletor"
    });
  }
}