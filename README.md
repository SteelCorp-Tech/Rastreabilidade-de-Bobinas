# Bobinas — protótipo de rastreabilidade

Protótipo só de front-end (React + Vite, JavaScript), sem backend, para validar telas e fluxo da rastreabilidade de bobinas de aço. Especificação em `CLAUDE.md`; decisões em `DECISIONS.md`.

## Como rodar

Requisitos: Node 20 ou superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes de domínio (Vitest)
npm run build      # gera dist/ (site estático, funciona em subpasta)
npm run dev:https  # dev em HTTPS (certificado de teste), para a câmera de um tablet na rede local
npm run preview    # serve o dist/ (build final, sem atualização a quente) em http://localhost:4173
npm run manual:capture  # refaz os prints do manual (precisa do app em http://localhost:4173 e do Edge ou Chrome)
npm run manual:build    # monta docs/manual/index.html
npm run manual:pdf      # gera docs/manual/manual-rastreabilidade-bobinas.pdf
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
- Incremento 7 (uso de bobina, tablet): leitura do CUB por leitor físico (campo com foco automático) ou pela câmera (`barcode-detector`: leitor nativo quando existe, senão ZXing em WebAssembly servido pelo próprio app), passo 1 (OP, obra e perfiladeira) e passo 2 (peso da sobra; sobra com etiqueta ou consumida). A câmera exige HTTPS (ou localhost).
- Incremento 8 (consulta, recall, bloqueio e auditoria; fecha a fatia v1): busca universal (atalho `/`), ficha do CUB com a cadeia de elos, recall por lote ou certificado, balanço de massa, pendências de certificado, dossiês por lote e por obra (imprimir e CSV), bloqueio e liberação com motivo (inclui "simular evento da FVM") e consulta da auditoria.

## Roteiro de aceite (CLAUDE.md seção 11)

O cenário completo roda só com o domínio em `src/domain/acceptance.test.js` (`npm test`). Pela interface, siga: Almoxarifado registra o lote 8948 (0,95 × 1.200 mm, 12.195 kg, certificado e NF anexados; sem certificado é recusado) → PCP salva o plano 7 × 166 mm e envia → Almoxarifado recebe a entrega de 14 CUBs (pré-preencher pelo plano) e imprime as etiquetas → Produção abre o uso de um CUB (OP X, obra Y), fecha com sobra de 300 kg, reabre para a obra Z e consome → Qualidade consulta o lote em Recall e relatórios → Qualidade bloqueia o lote e a Produção é recusada → Auditor vê tudo em Auditoria. Depois, Configurações → Restaurar dados de exemplo.

## Banco de dados (proposta para o backend)

`db/schema.sql` traz o modelo em PostgreSQL para quando houver backend (tabelas, regras, views e dados de referência). O protótipo continua sem banco. Explicação, decisões e validação (`db/validate.mjs`) em [db/README.md](db/README.md).

## Manual do usuário

Em `docs/manual/`: `manual-rastreabilidade-bobinas.pdf` (para ler ou imprimir) e `index.html` (mesmo conteúdo, com as imagens em `img/`). São 16 capítulos e 65 telas com setas numeradas.

Os prints são gerados por `scripts/manual/capture.mjs`, que percorre o sistema como um usuário num Edge (ou Chrome) invisível, com perfil temporário (não toca no seu navegador) e desenha as setas por cima de cada tela. A legenda de cada figura vem do mesmo roteiro, então texto e imagem não se desencontram. O texto está em `scripts/manual/content.mjs`. Quando uma tela mudar: `npm run build`, `npm run preview`, `npm run manual:capture`, `npm run manual:build` e `npm run manual:pdf`.
