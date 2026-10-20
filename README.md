# Bobinas — protótipo de rastreabilidade

Protótipo só de front-end (React + Vite, JavaScript), sem backend, para validar telas e fluxo da rastreabilidade de bobinas de aço. Especificação em `CLAUDE.md`; decisões em `DECISIONS.md`.

## Como rodar

Requisitos: Node 20 ou superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes de domínio (Vitest)
npm run build      # gera dist/ (site estático, funciona em subpasta)
npm run preview    # serve o dist/ para conferir
```

## Estrutura

```
src/domain/        regras puras (sem React), com testes ao lado
src/persistence/   repositório, anexos (IndexedDB), executor de comandos
src/ui/            app (rotas, layout, perfil), componentes, páginas
src/styles/        tokens de tema, base, impressão
scripts/           geração do seed a partir do Excel
```

## Estado atual

- Incremento 0 (fundação): shell no visual do SteelApps, seletor de perfil simulado com menu por permissão. As telas dos módulos são provisórias.
- Incremento 1 (domínio): regras puras em `src/domain/` (plano de corte, CUB, mãe, entrega, uso, bloqueio, balanço de massa, rastreabilidade, auditoria) e `commands.js`, que aplica permissão, regra e AuditLog sobre o estado inteiro. `acceptance.test.js` percorre os 7 critérios de aceite só com o domínio.
- Incremento 2 (persistência e seed): `src/persistence/` (repositório em localStorage, anexos em IndexedDB, executor de comandos com trava entre abas) e `npm run seed`, que lê o Excel (na raiz do projeto, fora do git) e gera `src/persistence/seed/seed.json` e `scripts/seed-report.md` (normalização de nomes e inconsistências). Em Configurações há o botão "Restaurar dados de exemplo".
- Incremento 3 (cadastros e configurações): `registryCommands.js` (fornecedor, usina, obra, perfiladeira, catálogo de materiais, configurações; só inativa, nunca apaga) e as telas Cadastros e Configurações. Importação CSV do catálogo fica para depois da fatia v1.
- Incremento 4 (bobinas mãe): lista com filtros (inclui "Sem certificado"), cadastro com anexo do certificado e da NF (IndexedDB) e ficha com histórico e a ação "Anexar ou substituir certificado" (auditada).
- Incremento 5 (plano de corte): lista de planos, editor com cálculo em tempo real e barra de tiras/refilo, versões e folha de impressão (`print.css`). Salvar um rascunho o atualiza; depois de enviado, salvar cria nova versão.
- Incremento 6 (recebimento, etiquetas e estoque): entrega com contagem declarada (ou justificativa), pré-preenchimento pelo plano, código ERP sugerido pelo catálogo, CUBs gerados e etiquetas com QR (A4 2 colunas ou térmica 100×50 mm); estoque com filtros, saldo por código ERP e posição editável.
