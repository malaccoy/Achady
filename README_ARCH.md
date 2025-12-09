# ACHADY Dashboard - Arquitetura de Produção

Este projeto utiliza uma arquitetura baseada em microsserviços containerizados para garantir estabilidade e persistência em VPS.

## Serviços

1. **Web (Next.js)**: Painel administrativo e API de controle.
2. **Bot (Node.js)**: Serviço dedicado ao WhatsApp (Baileys).
3. **Database (PostgreSQL)**: Persistência de dados.
4. **Proxy (Nginx)**: Entrada segura (SSL) e roteamento.

## Estrutura de Pastas

- `/apps/bot`: Serviço do WhatsApp.
- `/apps/web`: Aplicação Next.js.
- `/infra`: Configurações de Nginx e Certbot.
- `/prisma`: Schema do banco de dados.

## Como Rodar (VPS)

1. Instale Docker e Docker Compose.
2. Configure o arquivo `.env` baseado no `.env.example`.
3. Execute: `docker-compose up -d --build`
4. Acesse o painel e gere o QR Code.

## Variáveis de Ambiente (.env)

```env
DATABASE_URL="postgresql://user:password@postgres:5432/achady_db?schema=public"
NEXTAUTH_SECRET="sua_chave_secreta_aqui"
NEXT_PUBLIC_API_URL="https://seu-dominio.com/api"
SHOPEE_APP_ID="seu_app_id" # Opcional, pode configurar via painel
SHOPEE_APP_SECRET="seu_app_secret" # Opcional
```
