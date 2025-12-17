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

4. **Execute o servidor backend:**
   ```bash
   npm start
   ```
   > **Nota:** O banco de dados SQLite será inicializado automaticamente na primeira execução.

5. **Em outro terminal, execute o frontend:**
   ```bash
   npm run dev
   ```

6. **Acesse a aplicação:**
   
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
- ✅ Webhook Instagram/Meta público para validação
- ✅ OAuth Instagram Business para integração multi-tenant

## Meta Instagram Webhook

Para integrar com o Instagram via Meta, configure o webhook:

### Configuração

1. **URL do Webhook**: `https://www.achady.com.br/api/meta/webhook/instagram`
2. **Token de Verificação**: Defina `META_IG_VERIFY_TOKEN` no arquivo `.env` com um token forte
3. No Meta Developer Console, configure a mesma URL e token

### Testando o Webhook

```bash
# Teste de verificação (deve retornar 200 e o challenge "123")
curl -i "https://www.achady.com.br/api/meta/webhook/instagram?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"

# Teste local (substitua SEU_TOKEN pelo valor de META_IG_VERIFY_TOKEN)
curl -i "http://localhost:3001/api/meta/webhook/instagram?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"
```

## Instagram Business OAuth

O Achady suporta integração com Instagram Business via OAuth para cada usuário (multi-tenant).

### Variáveis de Ambiente Necessárias

Configure no `.env`:

```env
META_APP_ID="seu_app_id_do_meta"
META_APP_SECRET="seu_app_secret_do_meta"
META_IG_REDIRECT_URI="https://www.achady.com.br/api/meta/auth/instagram/callback"
META_IG_SCOPES="instagram_basic,instagram_manage_messages,instagram_manage_comments"
META_IG_STATE_COOKIE="achady_ig_oauth_state"
```

### Rotas Disponíveis

| Rota | Método | Autenticação | Descrição |
|------|--------|--------------|-----------|
| `/api/meta/auth/instagram` | GET | Requer login | Inicia o fluxo OAuth, redireciona para Meta |
| `/api/meta/auth/instagram/callback` | GET | Requer login | Recebe code, troca por token, salva integração |
| `/api/meta/instagram/status` | GET | Requer login | Retorna status da integração do usuário |
| `/api/meta/instagram/disconnect` | DELETE | Requer login | Desconecta a integração do usuário |

### Fluxo de Integração

1. Usuário faz login no Achady
2. Acessa `/api/meta/auth/instagram` 
3. É redirecionado para o Facebook para autorizar
4. Após autorização, volta para o callback
5. O sistema troca o code por token (curto → longo prazo)
6. Busca as Pages do usuário com Instagram Business conectado
7. Salva a integração no banco (tokens criptografados)
8. Redireciona para `/integracoes/instagram?status=connected`

### Testando a Integração

```bash
# 1. Fazer login no Achady (via frontend ou obter cookie token)

# 2. Acessar a URL de OAuth (abrirá no navegador)
# https://www.achady.com.br/api/meta/auth/instagram

# 3. Após conectar, verificar status:
curl -b "token=SEU_JWT_TOKEN" "https://www.achady.com.br/api/meta/instagram/status"

# 4. Para desconectar:
curl -X DELETE -b "token=SEU_JWT_TOKEN" "https://www.achady.com.br/api/meta/instagram/disconnect"
```

### Requisitos no Meta Developer Console

1. Criar um App do tipo "Business"
2. Adicionar o produto "Instagram"
3. Configurar OAuth redirect URI
4. Solicitar as permissões necessárias
5. O usuário deve ter uma Page com Instagram Business Account vinculada

### Campos Salvos no Banco

A tabela `SocialAccount` armazena:
- `userId` - ID do usuário Achady
- `provider` - 'instagram'
- `pageId` - ID da Facebook Page
- `igBusinessId` - ID da conta Instagram Business
- `igUsername` - Username do Instagram
- `pageAccessToken` - Token da Page (criptografado)
- `userAccessToken` - Token do usuário long-lived (criptografado)
- `expiresAt` - Data de expiração do token

## Instagram: Requisitos para o Usuário

Para utilizar a integração Instagram no Achady, o usuário precisa atender aos seguintes requisitos:

### Requisitos Obrigatórios

1. **Conta Instagram Profissional**: A conta Instagram deve ser do tipo Business ou Criador (Creator). Contas pessoais não têm acesso às APIs necessárias.

2. **Página do Facebook vinculada**: O Instagram Profissional deve estar conectado a uma Página do Facebook onde o usuário seja administrador.

3. **Permissões OAuth**: Durante a conexão, o usuário deve autorizar todas as permissões solicitadas para que o Achady possa gerenciar comentários e enviar DMs.

### Como verificar se sua conta está correta

1. Abra o app do Instagram
2. Vá em Configurações → Conta
3. Verifique se aparece "Mudar para conta profissional" ou se já mostra "Conta profissional"
4. Se for profissional, verifique em "Ferramentas para negócios" → "Página do Facebook conectada"

### Solução de problemas comuns

| Problema | Solução |
|----------|---------|
| Posts não aparecem | Verifique se a conta é Profissional e clique em "Sincronizar" |
| Conexão limitada | Sua conta pode não estar corretamente vinculada a uma Página |
| Permissão insuficiente | Aceite todas as permissões durante a autorização OAuth |

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
