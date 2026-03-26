# EquipControl

Sistema de controle patrimonial para instituições de ensino, agora em estrutura local com Vite, React modular e integração real com Supabase.

## Stack
- React 19
- Vite 5
- Tailwind CSS local
- Supabase Auth + Database

## Executar localmente
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de ambiente:
   ```bash
   copy .env.example .env
   ```
3. Preencha `.env` com:
   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
   ```
4. No Supabase, rode `supabase/schema.sql` e depois `supabase/seed.sql` no SQL Editor.
5. Inicie o ambiente local:
   ```bash
   npm run dev
   ```
6. Acesse `http://localhost:5173`.

## Deploy na Vercel
1. Importe o repositório na Vercel.
2. Framework preset: `Vite`.
3. Build command:
   ```bash
   npm run build
   ```
4. Output directory:
   ```bash
   dist
   ```
5. Configure as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. O arquivo `vercel.json` já faz o rewrite necessário para o React Router.

## Supabase
- O frontend usa apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- O cadastro cria perfil automaticamente na tabela `profiles`.
- Novos usuários entram como `professor` por padrão.
- Para promover um usuário para `admin` ou `technician`, rode algo como:
  ```sql
  update public.profiles
  set role = 'admin'
  where email = 'admin@seudominio.com';
  ```

## Funcionalidades implementadas
- Autenticação com login, cadastro, persistência de sessão e logout.
- Rotas protegidas e bloqueio por papel para telas administrativas.
- Dashboard com métricas reais.
- CRUD funcional de ativos, caixas, empréstimos e incidentes.
- Checklist e auditoria com gravação real no Supabase.
- Estados de carregamento, erro, vazio e validação básica.
- Exportação CSV de ativos.
