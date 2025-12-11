<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ACHADY Bot - Automação de Ofertas Shopee

Sistema completo de automação para envio de ofertas do Shopee via WhatsApp.

View your app in AI Studio: https://ai.studio/apps/drive/1LDnOOoLxV57_jRqS5Re0KsDt79j87CTJ

## Funcionalidades

- 🔐 Sistema de autenticação completo (registro, login, recuperação de senha)
- 📱 Integração com WhatsApp Web
- 🛍️ API Shopee para busca de ofertas
- 🤖 Automação de envio de mensagens para grupos
- 📊 Logs e histórico de envios
- 🎨 Interface moderna com React + TypeScript

## Pré-requisitos

- Node.js (v16 ou superior)
- NPM ou Yarn

## Instalação e Configuração

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/malaccoy/Achady.git
   cd Achady
   ```

2. **Instale as dependências:**
   ```bash
   PUPPETEER_SKIP_DOWNLOAD=true npm install
   ```

3. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   
   Edite o arquivo `.env` e configure:
   - `DATABASE_URL`: Caminho do banco de dados SQLite
   - `JWT_SECRET`: Chave secreta para JWT (use uma senha forte!)
   - `MASTER_KEY`: Chave para criptografia de dados sensíveis
   - Outras configurações opcionais (SMTP, etc)

4. **Inicialize o banco de dados:**
   ```bash
   npx prisma db push
   ```

5. **Execute o servidor backend:**
   ```bash
   npm start
   ```

6. **Em outro terminal, execute o frontend:**
   ```bash
   npm run dev
   ```

7. **Acesse a aplicação:**
   
   Abra seu navegador em `http://localhost:5173`

## Estrutura do Projeto

```
├── components/          # Componentes React
├── services/           # Serviços de API
├── api/               # Endpoints Vercel
├── prisma/            # Schema e migrations do banco
├── achady-server.js   # Servidor backend Express
└── App.tsx            # Componente principal
```

## Uso

1. **Criar Conta**: Registre-se com email e senha
2. **Conectar WhatsApp**: Escaneie o QR Code para conectar
3. **Configurar Shopee API**: Adicione suas credenciais da API Shopee
4. **Adicionar Grupos**: Adicione links de grupos do WhatsApp
5. **Ativar Automação**: Configure e ative o envio automático

## Problemas Resolvidos

- ✅ Correção do sistema de criação de contas
- ✅ Adição dos modelos `Log` e `SentOffer` no Prisma schema
- ✅ Validação completa do fluxo de autenticação
- ✅ Configuração adequada do ambiente de desenvolvimento

## Desenvolvimento

```bash
# Modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Validar schema Prisma
npx prisma validate

# Gerar Prisma Client
npx prisma generate
```

## Licença

Este projeto é privado e de uso restrito.
