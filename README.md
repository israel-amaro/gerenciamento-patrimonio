# EquipControl

Sistema de controle patrimonial para instituições de ensino, com foco em ativos, carrinhos, laboratórios, empréstimos, auditorias técnicas, QR Codes públicos e relatórios administrativos.

## Stack
- React 19
- Vite 5
- Tailwind CSS
- Supabase Auth + Postgres

## Estrutura do projeto
- `src/pages`: telas administrativas e páginas públicas de QR
- `src/lib`: integração com Supabase, geração de QR e utilitários de impressão
- `src/components`: componentes base da interface
- `supabase/schema.sql`: estrutura principal do banco
- `supabase/migrations/20260327_qr_public_workflows.sql`: ajustes de QR público, incidentes, checklists e relatórios
- `supabase/reset_for_production.sql`: limpeza completa dos dados para entrada em produção

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
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
   ```
4. No Supabase, rode nesta ordem:
   ```text
   supabase/schema.sql
   supabase/migrations/20260327_qr_public_workflows.sql
   supabase/seed.sql
   ```
5. Inicie o ambiente local:
   ```bash
   npm run dev
   ```
6. Acesse `http://localhost:5173`

## Implantação na empresa
1. Execute `supabase/reset_for_production.sql` no banco que hoje está com dados de teste.
2. Se quiser apagar também os usuários de autenticação, rode separadamente:
   ```sql
   delete from auth.users;
   ```
3. Reimporte somente os dados reais da empresa.
4. Configure na hospedagem as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Gere o build:
   ```bash
   npm run build
   ```

## Observações de segurança
- O arquivo `.env` está no `.gitignore` e não deve ser versionado.
- A chave `VITE_SUPABASE_ANON_KEY` é pública por natureza, mas ainda assim deve ficar fora do repositório.
- Se a chave atual já foi exposta fora do ambiente controlado, o ideal é gerar uma nova no Supabase antes do go-live.

## Funcionalidades principais
- Cadastro e gestão de ativos, carrinhos e laboratórios
- QR individual para consulta e auditoria de ativo
- QR público para empréstimo e devolução de carrinhos e laboratórios
- Checklists rápidos públicos
- Auditoria técnica com geração automática de incidentes
- Tela administrativa de defeitos com detalhamento
- Histórico de movimentação
- Relatórios em PDF por período
- Impressão de etiquetas com QR Code
