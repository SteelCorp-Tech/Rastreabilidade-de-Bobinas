# Banco de dados (proposta para o backend)

`schema.sql` é o modelo em PostgreSQL para quando o protótipo ganhar backend. **O app de hoje não usa banco**: continua 100% no navegador (CLAUDE.md, seção 8.1). Este arquivo é só o desenho, para discutir e validar.

## Como aplicar

Num PostgreSQL 13 ou mais novo, com um banco vazio:

```bash
psql -v ON_ERROR_STOP=1 -d bobinas -f backend/db/schema.sql
```

Tudo fica no schema `bobinas`. A aplicação deve conectar com `search_path = bobinas, public`, por exemplo `ALTER ROLE <usuario_do_app> SET search_path = bobinas, public`.

## Decisões do modelo

| Decisão | Motivo |
|---|---|
| Chave interna `id bigint`; `cub`, `slitter_lot` e nº do certificado como `UNIQUE` | Rápido e simples. As chaves de negócio continuam únicas. |
| Nada derivável fica duplicado (lote, fornecedor e certificado do CUB; contagem de usos; última obra) | No navegador essas cópias existem; no banco elas viram JOIN e as views `coil_stock` e `delivery_lots`, e nunca divergem. |
| Ciclo de vida e bloqueio separados (`status` + `blocked_at`) | Liberar é só limpar o bloqueio, sem guardar "o status de antes". Um lote bloqueado bloqueia os CUBs pela view (`display_status = 'BLOCKED'`). |
| `certificate` em tabela própria | Um certificado pode valer para mais de uma bobina mãe (recall por certificado). |
| Resultados do plano de corte gravados (`trim_*`, `total_cubs`, `weight_limit_used`) | Mudar o limite de peso depois não reescreve um plano antigo. |
| Numeração do CUB em `cub_sequence` + `reserve_cub_seq()` | Reserva o bloco dentro da transação: sem número repetido entre recebimentos simultâneos e sem reaproveitar número de CUB excluído. Começa em 575 em 2026 (marco zero). |
| `config` com uma linha só e colunas tipadas | O banco valida tipo e faixa (ex.: refilo mínimo ≤ máximo). |
| Matriz de permissões efetiva em `role_action` / `role_view` | O padrão de `permissions.js` vem gravado; "restaurar padrão" regrava as linhas do perfil. Um gatilho impede mexer no ADMIN, dar ação ao AUDITOR e conceder ação ou tela administrativa. |
| Exclusão do administrador = `DELETE` de verdade, com chaves estrangeiras | O banco repete a regra do app: recebimento só sai se nenhum CUB foi usado (`coil_use` sem cascata); bobina mãe só sai sem CUBs; planos saem junto com a mãe. O conteúdo excluído vai para `audit_log.before`. |
| `audit_log` só aceita inclusão | Gatilho recusa `UPDATE`, `DELETE` e `TRUNCATE`. |
| Sem `tenant_id` por enquanto | Multiempresa está fora do protótipo. Se for o caminho, entra em todas as tabelas com Row-Level Security. |
| Marco zero | O banco começa vazio (com os dados de referência). O histórico continua no Excel. |

## Invariantes do CLAUDE.md 5.2 que o banco também garante

- CUB único, com texto coerente com ano e sequencial (`CHECK`), e nunca reutilizado (`cub_sequence`).
- Um uso aberto por CUB (`UNIQUE` parcial em `coil_use`), e abrir uso exige o CUB em estoque, sem bloqueio do CUB nem do lote (gatilho `coil_use_open_guard`).
- `weight_after <= weight_before`, `consumption` calculado pelo banco, consumida ⇒ peso final 0, sobra ⇒ peso final > 0.
- Espessura e galvanização da tira iguais às da bobina mãe, e iguais às do material do catálogo quando houver (chaves estrangeiras compostas).
- Lote, NF do prestador e peso recebido obrigatórios para o CUB existir.
- Um único plano de corte vigente por bobina mãe (`UNIQUE` parcial).

Ficam na aplicação, porque dependem da configuração ou de outra tabela: certificado obrigatório, faixa de refilo, contagem declarada igual à recebida (ou justificativa) e o alerta de uso duplicado no mesmo dia.

## Ordem das operações que a aplicação deve seguir

- **Recebimento:** `reserve_cub_seq(ano, quantidade)` → insere `delivery` → insere os `coil` com os números reservados → atualiza a `mother_coil` → `audit_log`. Tudo numa transação.
- **Abrir uso:** insere `coil_use` (o gatilho confere estoque e bloqueio) → `UPDATE coil SET status = 'IN_USE'` → `audit_log`.
- **Fechar uso:** atualiza `coil_use` (peso final, resultado) → atualiza `coil` (peso atual; `CONSUMED` ou `IN_STOCK`) → `audit_log`.
- **Gravar com trava otimista:** `UPDATE ... WHERE id = $1 AND version = $2`. Nenhuma linha afetada significa que outra pessoa gravou antes.

## Validação

`backend/db/validate.mjs` aplica o schema num PostgreSQL 16 embutido (PGlite) e faz 73 verificações: o fluxo completo (cadastro → bobina mãe → plano → recebimento → uso com sobra → uso consumido), cada regra que deve recusar (lote e CUB repetidos, segundo plano vigente, CUB com galvanização ou largura diferente, segundo uso aberto, uso em lote bloqueado, pesos incoerentes, auditoria alterada, permissões administrativas concedidas, exclusões com uso), a numeração do CUB e as 6 views. Em 26/10/2026: **73 ok, 0 falhas**.

```bash
cd backend
npm install --no-save @electric-sql/pglite@0.2.17
npm run validar-schema
```

O `--no-save` não altera o `package.json` do backend. Para conferir num PostgreSQL de verdade, use o `psql` acima.

## Pontos para a revisão

- **Bloqueio separado do status** (`blocked_at`): o protótipo hoje usa `BLOCKED` como status do CUB. A view `coil_stock` devolve `display_status = 'BLOCKED'`, mas o backend precisa adotar a separação.
- **CUB consumido com uso aberto**: o banco não impede marcar o CUB como `CONSUMED` (ou de volta a `IN_STOCK`) enquanto há um uso aberto; isso fica na ordem de operações da aplicação (acima). Dá para fechar com um gatilho, se preferirem.
- **`entity_id` da auditoria é texto** (o app grava ids separados por vírgula em eventos que envolvem mais de uma entidade).
- **A permissão `data.reset`** ("Apagar todos os dados") acompanha a PR do app vazio; até ela entrar na `main`, o app ainda usa `seed.restore`.
- Falta decidir: `bigint` × `uuid`, `DELETE` × `deleted_at`, multiempresa (`tenant_id`) e o login (SSO do portal).
