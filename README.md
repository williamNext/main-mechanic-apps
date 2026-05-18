# Acesso Mecânico

App Expo para acesso de mecânicos, espelhado de `oficina`.

Escopo implementado:
- login de mecânico e solicitação de acesso pendente
- agenda para agendamentos atribuídos
- detalhe do agendamento com cancelamento pelo mecânico
- criação, bloqueio, reabertura e exclusão de horários
- perfil do mecânico e logout

Ainda não implementado:
- pagamentos
- mensagens
- fluxo de orçamento
- avaliações

## Modelo de segredos
- `public-build-vars`: seguro no bundle do cliente.
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `private-server-secrets`: nunca enviar ao app mobile.
  - service-role keys
  - admin tokens

## Configuração de ambiente
1. Crie `.env` a partir de `.env.example`.
2. Configure:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. No Netlify, configure as mesmas chaves em Configuração do site > Variáveis de ambiente.

## Desenvolvimento local
```bash
npm install
npm run hooks:setup
npm run start
```

## Validação e seed
```bash
npm run env:check
npm run seed
```

Workflow executa:
- gitleaks em PR/push
- validação de env em push para `master`

## Limpeza de histórico para `.env` vazado
Execute uma vez na máquina do mantenedor, depois force push:
```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
git push origin --force --tags
```

Depois do force-push, colaboradores devem fazer hard reset ou clonar novamente.
