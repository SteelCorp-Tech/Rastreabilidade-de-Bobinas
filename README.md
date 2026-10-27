# Bobinas — protótipo de rastreabilidade

Protótipo só de front-end (React + Vite, JavaScript), sem backend, para validar telas e fluxo da rastreabilidade de bobinas de aço. Especificação em `CLAUDE.md`; decisões em `DECISIONS.md`.

## Como rodar

Requisitos: Node 20 ou superior. Sem workspaces: cada pasta tem o próprio `package.json`; o da raiz só tem atalhos.

```bash
npm run instalar   # instala compartilhado, frontend e backend
npm run dev        # app em http://localhost:5173
npm test           # testes do domínio (compartilhado) e do frontend (Vitest)
npm run verificar  # testes + build do frontend
npm run build      # gera frontend/dist/ (site estático, funciona em subpasta)
npm run preview    # serve o frontend/dist/ em http://localhost:4173
npm run dev:https  # dev em HTTPS (certificado de teste), para a câmera de um tablet na rede local
```

Dentro de cada pasta (`cd frontend`, `cd backend`...) os comandos de cada parte:

```bash
# frontend
npm run manual:capture  # refaz os prints do manual (precisa do app em http://localhost:4173 e do Edge ou Chrome)
npm run manual:build    # monta docs/manual/index.html
npm run manual:pdf      # gera docs/manual/manual-rastreabilidade-bobinas.pdf
# backend
npm run seed            # lê a planilha de controle (na raiz, fora do git) e grava em backend/scripts/out/ (fora do git)
npm run validar-schema  # valida backend/db/schema.sql (ver backend/db/README.md)
```

## Estrutura

Mesma organização dos outros módulos do SteelApps (ex.: FinanceiroEstrategico):

```
compartilhado/dominio/   regras puras (sem React): plano de corte, CUB, estados, permissões, exclusões; testes ao lado.
                         O frontend importa como '@dominio/...'; o backend vai usar as mesmas regras.
frontend/                o app (React + Vite)
  src/ui/                rotas, layout, perfil, componentes, páginas
  src/persistence/       repositório no navegador (localStorage), anexos (IndexedDB), executor de comandos
  src/styles/            tokens de tema, base, impressão
  scripts/               HTTPS de desenvolvimento e geração do manual
backend/                 base do backend (ainda sem servidor)
  db/                    schema PostgreSQL, explicação e validação
  scripts/               leitura da planilha de controle (base da futura importação)
docs/manual/             manual do usuário (HTML e PDF)
CLAUDE.md, DECISIONS.md  especificação e decisões
```

## Estado atual

- Incremento 0 (fundação): shell no visual do SteelApps, seletor de perfil simulado com menu por permissão. As telas dos módulos são provisórias.
- Incremento 1 (domínio): regras puras em `compartilhado/dominio/` (antes `src/domain/`) (plano de corte, CUB, mãe, entrega, uso, bloqueio, balanço de massa, rastreabilidade, auditoria) e `commands.js`, que aplica permissão, regra e AuditLog sobre o estado inteiro. `acceptance.test.js` percorre os 7 critérios de aceite só com o domínio.
- Incremento 2 (persistência e seed): `frontend/src/persistence/` (repositório em localStorage, anexos em IndexedDB, executor de comandos com trava entre abas) e `npm run seed`, que lê o Excel (na raiz do projeto, fora do git) e gera `src/persistence/seed/seed.json` e `scripts/seed-report.md` (normalização de nomes e inconsistências). Em Configurações há o botão "Restaurar dados de exemplo".
- Incremento 3 (cadastros e configurações): `registryCommands.js` (fornecedor, usina, obra, perfiladeira, catálogo de materiais, configurações; só inativa, nunca apaga) e as telas Cadastros e Configurações. Importação CSV do catálogo fica para depois da fatia v1.
- Incremento 4 (bobinas mãe): lista com filtros (inclui "Sem certificado"), cadastro com anexo do certificado e da NF (IndexedDB) e ficha com histórico e a ação "Anexar ou substituir certificado" (auditada).
- Incremento 5 (plano de corte): lista de planos, editor com cálculo em tempo real e barra de tiras/refilo, versões e folha de impressão (`print.css`). Salvar um rascunho o atualiza; depois de enviado, salvar cria nova versão.
- Incremento 6 (recebimento, etiquetas e estoque): entrega com contagem declarada (ou justificativa), pré-preenchimento pelo plano, código ERP sugerido pelo catálogo, CUBs gerados e etiquetas com QR (A4 2 colunas ou térmica 100×50 mm); estoque com filtros, saldo por código ERP e posição editável.
- Incremento 7 (uso de bobina, tablet): leitura do CUB por leitor físico (campo com foco automático) ou pela câmera (`barcode-detector`: leitor nativo quando existe, senão ZXing em WebAssembly servido pelo próprio app), passo 1 (OP, obra e perfiladeira) e passo 2 (peso da sobra; sobra com etiqueta ou consumida). A câmera exige HTTPS (ou localhost).
- Incremento 8 (consulta, recall, bloqueio e auditoria; fecha a fatia v1): busca universal (atalho `/`), ficha do CUB com a cadeia de elos, recall por lote ou certificado, balanço de massa, pendências de certificado, dossiês por lote e por obra (imprimir e CSV), bloqueio e liberação com motivo (inclui "simular evento da FVM") e consulta da auditoria.

## Roteiro de aceite (CLAUDE.md seção 11)

O cenário completo roda só com o domínio em `compartilhado/dominio/acceptance.test.js` (`npm test`). Pela interface, siga: Almoxarifado registra o lote 8948 (0,95 × 1.200 mm, 12.195 kg, certificado e NF anexados; sem certificado é recusado) → PCP salva o plano 7 × 166 mm e envia → Almoxarifado recebe a entrega de 14 CUBs (pré-preencher pelo plano) e imprime as etiquetas → Produção abre o uso de um CUB (OP X, obra Y), fecha com sobra de 300 kg, reabre para a obra Z e consome → Qualidade consulta o lote em Recall e relatórios → o Administrador bloqueia o lote e a Produção é recusada → Auditor vê tudo em Auditoria. Depois, Configurações → Apagar todos os dados. Antes, cadastre em Cadastros o fornecedor, a obra e a perfiladeira (o app começa vazio).

## Banco de dados (proposta para o backend)

`backend/db/schema.sql` traz o modelo em PostgreSQL para quando houver backend (tabelas, regras, views e dados de referência). O protótipo continua sem banco. Explicação, decisões e validação (`backend/db/validate.mjs`) em [backend/db/README.md](backend/db/README.md).

## Manual do usuário

Em `docs/manual/`: `manual-rastreabilidade-bobinas.pdf` (para ler ou imprimir) e `index.html` (mesmo conteúdo, com as imagens em `img/`). São 16 capítulos e 65 telas com setas numeradas.

Os prints são gerados por `frontend/scripts/manual/capture.mjs`, que percorre o sistema como um usuário num Edge (ou Chrome) invisível, com perfil temporário (não toca no seu navegador) e desenha as setas por cima de cada tela. A legenda de cada figura vem do mesmo roteiro, então texto e imagem não se desencontram. O texto está em `frontend/scripts/manual/content.mjs`. Quando uma tela mudar: `npm run build`, `npm run preview`, `npm run manual:capture`, `npm run manual:build` e `npm run manual:pdf`.

## Dados

O app **começa vazio** (desde 26/10/2026): nenhuma bobina, cadastro ou catálogo. Os dados ficam no navegador (`localStorage` e anexos em IndexedDB). Em Configurações, o administrador tem **"Apagar todos os dados"**, que zera tudo e mantém só configurações, permissões e a numeração do CUB (o próximo CUB continua depois do último já emitido, a partir de CUB-2026-00576).

`npm run seed` (na pasta `backend`) ainda lê a planilha de controle, mas grava em `backend/scripts/out/` (fora do git) e o app não carrega esse resultado; ele fica como base para a futura importação.
