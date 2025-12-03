
import { db } from './db';
import { OfertaShopee } from '../types';

export const automationService = {
  
  formatarMensagem: (userId: string, oferta: OfertaShopee): string => {
    // 1. Buscar Modelo de Mensagem
    const modelo = db.getModelo(userId);
    
    if (!modelo || !modelo.modeloTexto || modelo.modeloTexto.trim() === '') {
      // Caso não exista modelo, loga erro? A especificação pede para retornar erro.
      // Vou logar o erro e lançar a exceção.
      const erroMsg = "Nenhum modelo de mensagem configurado.";
      db.registrarLog(userId, "Sistema", erroMsg, "erro");
      throw new Error(erroMsg);
    }

    let texto = modelo.modeloTexto;

    // Helper para formatar moeda BRL
    const formatMoney = (val: number) => {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // 2. Substituir Variáveis
    // {{titulo}} → oferta.titulo
    texto = texto.replace(/{{titulo}}/g, oferta.titulo);
    
    // {{preco}} → oferta.precoPromocional
    texto = texto.replace(/{{preco}}/g, formatMoney(oferta.precoPromocional));
    
    // {{precoOriginal}} → oferta.precoOriginal
    texto = texto.replace(/{{precoOriginal}}/g, formatMoney(oferta.precoOriginal));
    
    // {{desconto}} → oferta.desconto
    texto = texto.replace(/{{desconto}}/g, oferta.desconto);
    
    // {{link}} → oferta.linkAfiliado
    texto = texto.replace(/{{link}}/g, oferta.linkAfiliado);

    // Limpeza de variáveis não usadas ou fallback (ex: cupom não está no objeto OfertaShopee mas pode estar no template)
    texto = texto.replace(/{{cupom}}/g, '');

    // 3. Registrar Log "Preview"
    db.registrarLog(
      userId,
      "Preview",
      texto,
      "formatado"
    );

    return texto;
  }
};
