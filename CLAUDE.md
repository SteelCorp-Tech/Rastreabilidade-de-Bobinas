# CLAUDE.md — Protótipo de controle de rastreabilidade de bobinas de aço (nome provisório)

> Contexto permanente do projeto. Leia inteiro antes de qualquer ação.
> Atualize este arquivo e o `DECISIONS.md` sempre que uma decisão mudar.

---

## 1. Como trabalhar comigo

- Responda em **português do Brasil**. Identificadores de código em **inglês**; textos de interface em **pt-BR**.
- Eu sou o dono do produto. Vamos refinar design, módulos, seções e telas conversando, em ciclos curtos.
- Seja parceiro de raciocínio, não executor. Se achar que estou errado, **contradiga e explique**. Prefiro ser contestado a ser agradado.
- Antes de qualquer trabalho grande, mostre um **plano curto e as perguntas em aberto**. Depois implemente em incrementos pequenos, que rodem a cada passo.
- Ao depurar, entregue **primeiro a solução mais rápida que funcione** (contorno ou alternativa prática). Só investigue a causa raiz se eu pedir.
- **Não altere meu ambiente** (instalações globais, serviços, arquivos fora deste projeto, qualquer coisa destrutiva) sem autorização explícita. Nunca faça mudanças exploratórias só para testar uma hipótese.
- Mantenha atualizados: `README.md` (como rodar), `DECISIONS.md` (decisões, motivo e data) e este arquivo.

---

## 2. O produto

Hoje: um **protótipo apenas de front-end, em React, sem backend**, para validar telas, módulos e fluxo. No futuro, a ideia é virar um SaaS; **nada disso entra agora**.

O controle dá **rastreabilidade ponta a ponta de bobinas de aço** para fábricas que compram bobina mãe, mandam fatiar (slitagem) fora e consomem as tiras em perfiladeiras para produzir peças destinadas a obras.

A pergunta que o sistema precisa responder em segundos, para uma auditoria de certificação ou um recall:

> "De qual bobina mãe, lote e certificado saiu o aço que foi para a obra X? E, dado um lote com problema, quais obras e ordens de produção consumiram esse aço?"

O produto nasce de um caso real (cliente de referência: **SteelCorp**, construção industrializada, Brasil). A versão atual do controle é uma planilha Excel; um piloto paralelo está sendo desenhado em um BPM (Holmes).

---

## 3. Cadeia física e papéis (cliente de referência)

```
Fornecedor/usina ──> BOBINA MÃE ──> slitagem (prestador) ──> TIRAS ──> fábrica ──> perfiladeira ──> peça ──> OBRA
                      (NF, certificado)   (atribui o LOTE,      (almoxarifado cola     (uso; sobra volta
                                           recebe o plano)       etiqueta com CUB)      ao estoque c/ mesmo CUB)
```

1. **Suprimentos** compra a bobina mãe. Ela é entregue **direto no prestador de slitagem**, não na fábrica.
2. O prestador atribui um **lote** (no cliente: "lote LS") à bobina mãe e informa por e-mail.
3. O **PCP** elabora o **plano de corte** (quantas tiras, de que largura) e envia ao prestador.
4. O prestador corta. As tiras voltam à fábrica em uma **entrega com NF do prestador**. Cada tira recebe uma **etiqueta com o CUB** (Código Único da Bobina) colada pelo **almoxarifado**.
5. A **Produção** usa a bobina na perfiladeira para uma **ordem de produção (OP)** de uma **obra**. A OP já traz a obra e tem QR code.
6. A **sobra** é pesada (a balança imprime etiqueta de peso) e **reetiquetada pela Produção com o mesmo CUB e o novo peso**. Pode ser usada de novo, em outra obra.
7. **Qualidade**: a validação do certificado é feita por uma pessoa específica, **fora** do sistema. O checklist da bobina e o tratamento de não conformidade são feitos em uma **ferramenta de FVM** já existente. **Não replicar isso aqui** (ver 8.6).

**O prestador de slitagem não é usuário nem cadastro do sistema.** Ele aparece só como dados digitados pelo almoxarifado (lote, OP do prestador, NF do prestador).

Papéis no sistema: Almoxarifado, PCP, Produção, Qualidade, Suprimentos, Administrador, Auditor (somente leitura).

---

## 4. Decisões já tomadas (não reabrir sem motivo)

| Decisão | Motivo |
|---|---|
| **O CUB é a chave da bobina** ("RG da bobina"). Formato `CUB-AAAA-NNNNN`. | Decisão do cliente em reunião. Cada tira/bobina física tem um CUB e o mantém até acabar. |
| **O lote do prestador é a chave da Qualidade** (certificado, validade, bloqueio, recall). | Nos dados reais, nenhum lote tem mais de um fornecedor ou galvanização, e só 1 tem mais de um certificado. |
| O almoxarifado registra a bobina mãe e o lote. | Decisão do cliente. |
| Limite de peso por bobina no desbobinador: **700 kg** (configurável). | Definido pela PCP em 22/10/2026 (antes: 1.000 kg, que bate com o histórico de 2026: tiras de ~1.687 kg viravam 2 bobinas de ~843,5 kg). |
| **Todo plano de corte deve deixar de 14 a 30 mm de refilo** (configurável; o sistema recusa salvar fora da faixa). | Regra da PCP, 22/10/2026. O lote real 8948 (refilo de 38 mm) não cumpriria. |
| Na etiqueta, **galvanização e dimensão ficam logo abaixo do lote**, em corpo grande. | Pedido da PCP, 22/10/2026. |
| **Bloqueio e liberação é só do Administrador** por padrão; as permissões de cada perfil são editáveis na tela Permissões (o Administrador sempre pode tudo). | Pedido do dono do produto, 23/10/2026. |
| **O Administrador pode excluir** bobina mãe (sem CUBs), plano de corte e recebimento (CUBs nunca usados), com confirmação e registro na auditoria. | Pedido do dono do produto, 23/10/2026. Exceção deliberada à regra de só inativar. |
| A Produção reetiqueta a sobra; checklist e não conformidade são da FVM. | Decisão do cliente. |
| Sem botão "trocar de obra" com bobina montada. | Quase não acontece. |
| Marco zero: inventário físico como carga inicial; histórico fica no Excel. | Evita migrar dados ruins. |
| O prestador de slitagem não entra no app. | Decisão do dono do produto. |
| Protótipo só em React, sem backend, banco, Supabase ou Vercel. | Decisão do dono do produto. |
| **JavaScript puro, sem TypeScript.** | Decisão do dono do produto. |
| **Hospedagem: página própria no portal SteelApps** (HashRouter, `base: "./"`, chaves `bobinas:v1:`). Leitura de QR pela câmera do tablet (exige HTTPS). Seed gerado do Excel real. Git local, um commit por incremento. | Decisões do dono do produto em 20/10/2026. |
| **O certificado de qualidade tem lugar no app**: número e arquivo anexado por bobina mãe, obrigatórios por padrão. | Decisão do dono do produto. É a prova central da auditoria (hoje 513 de 826 CUBs estão sem certificado válido). |

---

## 5. Modelo de domínio

Valores: peso em **kg com 1 casa decimal**; espessura em **mm com 2 casas**; largura em **mm**. Datas exibidas em America/Sao_Paulo.

### 5.1 Entidades

**Supplier** (fornecedor da bobina mãe), **Mill** (usina fabricante), **Project** (obra), **Machine** (perfiladeira): cadastros simples, com código externo opcional.

**Material** — catálogo que mapeia **(espessura, largura exata, galvanização) → código ERP**. Vários registros podem apontar para o mesmo código (a largura varia alguns mm dentro da tolerância). No cliente: ~160 linhas, 73 códigos, galvanizações Z275 e Z350, espessuras 0,80 / 0,95 / 1,25 / 1,55 mm, larguras de 31 a 395 mm (são tiras; as bobinas mãe não estão no catálogo).

**MotherCoil (Bobina Mãe)** — `slitter_lot` (lote do prestador, texto), `mill_coil_number` (nº da bobina na usina), `supplier`, `mill`, `purchase_order_ref`, `supplier_invoice_number`, `supplier_invoice_date`, `thickness`, `width`, `galvanization`, `net_weight`, `slitter_entry_date`, `certificate_number`, `certificate_file` (PDF ou imagem anexados), `certificate_attached_at/by`, `slitter_job_ref` (OP do prestador, texto), `status`, `received_at`.
- Estados: `REGISTERED` → `PLANNED` (plano enviado) → `SCHEDULED` (programação confirmada) → `RECEIVED` (tiras recebidas); `BLOCKED` pode ocorrer em qualquer ponto.

**CuttingPlan (Plano de Corte)** — pertence a uma bobina mãe; tem versões (ajustes). Linhas: `strip_count`, `strip_width`. Campos calculados na seção 6. Também `expected_delivery_date`.

**Delivery (Entrega/Recebimento)** — `slitter_invoice_number` (NF do prestador, texto), `received_date`, `declared_coil_count`, `total_weight` (opcional), `delivery_note_file`, `fvm_number` (opcional). **Uma entrega pode trazer tiras de mais de um lote**; um lote costuma chegar em uma entrega só (94% dos lotes).

**Coil (CUB)** — `cub` (único), `mother_coil`, `delivery`, `slitter_lot` (denormalizado), `slitter_invoice_number`, `received_date`, `supplier`, `galvanization`, `thickness`, `width`, `material` (catálogo), `certificate_number`, `fvm_number`, `received_weight`, `current_weight`, `status`, `storage_location`, `last_project`, `last_production_order`, `use_count`, `cumulative_consumption`.
- Estados: `IN_STOCK`, `IN_USE`, `BLOCKED`, `CONSUMED`, `RETURNED`.

**CoilUse (Uso)** — um registro por uso: `coil`, `production_order`, `project`, `machine`, `weight_before`, `weight_after`, `consumption`, `scrap_weight`, `outcome` (`LEFTOVER` | `CONSUMED`), `opened_by/at`, `closed_by/at`, foto da etiqueta da sobra (opcional).

**AuditLog** — lista só de inclusão: quem (perfil simulado), quando, entidade, ação, antes e depois.

### 5.2 Invariantes (impostas pelas funções de domínio, não pela tela)

- `cub` é único e **nunca é reutilizado**. A sobra mantém o mesmo CUB.
- Um CUB só pode ter **um uso aberto por vez**. Abrir um uso exige status `IN_STOCK` e muda para `IN_USE` na mesma operação.
- `weight_after <= weight_before`. `consumption = weight_before − weight_after`. Consumida: `weight_after = 0`.
- O número de CUBs de uma entrega deve ser igual a `declared_coil_count` (a tela só fecha com a contagem igual, ou com justificativa registrada).
- Uma bobina só entra em `IN_STOCK` com **lote, NF do prestador e peso recebido preenchidos**.
- **Certificado**: número e arquivo anexado são obrigatórios no registro da bobina mãe (padrão; a configuração `certificate_required` pode relaxar). A validação em si é externa; o sistema registra e prova que existe. Se a configuração permitir registrar sem ele, a bobina fica marcada **"sem certificado"** e aparece nas pendências até alguém anexar.
- Um CUB `BLOCKED` ou `CONSUMED` não pode abrir uso. A mensagem de recusa diz o motivo.

---

## 6. Plano de corte: cálculos e caso de teste

Entradas: largura da mãe `W`, peso líquido `P`, limite por bobina `L` (padrão 700 kg), linhas `(n_i, w_i)`.

| Resultado | Fórmula |
|---|---|
| Largura utilizada | `Σ n_i × w_i` |
| Refilo (mm) | `W − largura utilizada` |
| Peso do refilo (kg) | `P × refilo / W` |
| Aproveitamento (%) | `largura utilizada / W × 100` |
| Peso de uma tira inteira (kg) | `t_i = P × w_i / W` |
| Bobinas por tira | `ceil(t_i / L)` (a tira é dividida no comprimento) |
| Peso estimado por CUB (kg) | `t_i / bobinas por tira` |
| CUBs previstos | `Σ n_i × bobinas por tira_i` |

> **Atenção (22/10/2026):** os números abaixo valem para o limite de 1.000 kg e sem regra de refilo (`CASO_8948` em `src/domain/test-helpers.js`). Com o padrão atual (700 kg; refilo de 14 a 30 mm), o 7 × 166 mm do lote 8948 seria recusado (refilo de 38 mm) e, se fosse aceito, daria 21 CUBs de ≈ 562,3 kg.

**Caso de teste obrigatório (lote real 8948):** mãe 0,95 × 1.200 mm, 12.195 kg; 7 tiras de 166 mm.
- Largura utilizada 1.162 mm; refilo 38 mm = **386,2 kg**; aproveitamento ≈ 96,8%.
- Cada tira pesa ≈ **1.687,0 kg** (1.686,975 antes de arredondar; calcular com precisão total e arredondar só na exibição) → **2 bobinas por tira** de ≈ **843,5 kg** → **14 CUBs** previstos.
- Com `L = 800`, o resultado seria 3 bobinas por tira e 21 CUBs. O teste deve cobrir os dois limites.

**Erro que a planilha atual comete e o sistema não pode repetir:** o refilo foi somado ao peso das bobinas (12.195 ÷ 14 = 871,1 kg, quando o correto é 11.808,8 ÷ 14 = 843,5 kg). Nenhum peso da planilha é medido; todos saem de rateio. Aqui o peso do CUB é **medido na balança** no recebimento, e o estimado serve só de referência.

---

## 7. Módulos e telas

### Protótipo v1 (fatia vertical, do registro à consulta)

1. **Cadastros** — fornecedores, usinas, obras, perfiladeiras, **catálogo de materiais** (com importação CSV).
2. **Bobinas mãe** — lista com filtros; cadastro (com anexo do certificado e da NF, guardados no navegador); detalhe com estado e histórico; ação **Anexar ou substituir certificado** na ficha, com registro na auditoria.
3. **Plano de corte** — editor de linhas com os cálculos em tempo real (seção 6), versões e impressão/exportação (v1: marcar como enviado e imprimir).
4. **Recebimento de entregas** — registrar a NF do prestador, a quantidade declarada e o romaneio; lançar uma linha por bobina com **peso medido** e largura; **gerar os CUBs e imprimir as etiquetas** (com QR).
5. **Estoque de CUBs** — lista e filtros por status, material, lote, galvanização, espessura; saldo por código ERP; posição no estoque.
6. **Uso de bobina** — pensado para **tablet e leitor de QR**, com poucos toques:
   - Passo 1 (montagem): ler o QR do CUB, informar OP e obra e a perfiladeira.
   - Passo 2 (fim do uso): pesar a sobra e escolher **sobra** (gera etiqueta com o mesmo CUB e o novo peso) ou **consumida**.
7. **Consulta e rastreabilidade** — busca universal (CUB, lote, NF, OP, obra, certificado, código ERP, dimensão) e **ficha da bobina com a cadeia de elos**: fornecedor e usina → bobina mãe (NF, certificado) → lote e OP do prestador → entrega → CUB → usos (OP e obra) → sobra. O certificado abre direto da ficha (visualizar e baixar), inclusive na ficha do CUB, herdado da mãe.
8. **Recall e relatórios** — dado um lote ou certificado: CUBs, saldo atual, obras e OPs que consumiram. **Balanço de massa por lote**: peso líquido da mãe contra soma dos pesos recebidos mais refilo. **Pendências de certificado**: bobinas mãe sem arquivo anexado. Exportar CSV e imprimir ("dossiê de rastreabilidade" por obra e por lote).
9. **Bloqueio e liberação** — o **Administrador** (padrão desde 23/10/2026; concedível a outros perfis na tela Permissões) bloqueia ou libera um CUB ou lote inteiro, com motivo obrigatório e registro na auditoria. O módulo só aparece no menu para quem tem a permissão.
10. **Importação inicial** (depois da fatia v1; o catálogo e o estoque iniciais entram pelo seed) — carga do estoque a partir de CSV, com **relatório de inconsistências** (seção 9).
11. **Auditoria** — consulta do AuditLog.
12. **Configurações** — limite de peso, faixa de refilo, formato do CUB, campos obrigatórios (inclui `certificate_required`), tema.
13. **Permissões** (Administrador) — para cada perfil, quais telas aparecem no menu e quais ações pode fazer. Travas: o Administrador sempre pode tudo, o Auditor nunca recebe ações, e configurações, permissões e exclusões não podem ser concedidas a outros perfis. Cada mudança vai para a auditoria e há "restaurar padrão" por perfil.

### Fica para depois do protótipo

Backend e banco, autenticação real, multiempresa, API e webhooks, integração com ERP (Microsys, Sienge) e com a FVM, conectores de BI, leitura do e-mail do prestador, impressão ZPL direta, modo offline, módulo de checklist/não conformidade nativo.

---

## 8. Requisitos transversais

**8.1 Sem backend.** Os dados vivem no navegador: estado em memória com persistência em `localStorage`; os **anexos (certificado, NF, romaneio) ficam em IndexedDB**, que o navegador já oferece e comporta PDFs sem estourar o limite do `localStorage`. Há **dados de exemplo (seed)** e um botão "Restaurar dados de exemplo". Sem login real.

**8.2 Perfis simulados.** Um seletor de perfil no rodapé do menu lateral, como no portal SteelApps (Almoxarifado, PCP, Produção, Qualidade, Suprimentos, Administrador, Auditor) muda o que cada pessoa vê e pode fazer:
- Almoxarifado: cadastrar bobina mãe (inclusive anexar o certificado) e entregas, gerar etiquetas.
- PCP: plano de corte.
- Produção: abrir e fechar uso, reetiquetar sobra.
- Qualidade: consultar e anexar certificado. (Bloquear e liberar é do Administrador por padrão.)
- Suprimentos: cadastros de fornecedor e pedido.
- Administrador: tudo, inclusive configurações, permissões, bloqueio e liberação e **exclusões** (bobina mãe sem CUBs, plano de corte e recebimento cujos CUBs nunca foram usados).
- Auditor: somente leitura, incluindo auditoria.

**8.3 Auditoria.** Todo evento relevante grava no AuditLog, sem edição nem exclusão. Registros de negócio não são apagados, só inativados, **exceto as exclusões do Administrador** (acima): o conteúdo excluído fica no AuditLog e um número de CUB já emitido nunca volta a ser usado.

**8.4 Etiquetas.** CUB sequencial por ano, gerado pela função de domínio (sem repetição, mesmo se duas abas estiverem abertas: toda gravação passa por um executor de comandos que pega uma trava entre abas, relê o storage, aplica a regra de domínio, grava e avisa as outras abas). O QR carrega o CUB. A etiqueta de sobra repete o CUB com o novo peso e a data. Impressão pelo navegador (`window.print` com folha de estilo própria).

**8.5 Experiência no chão de fábrica.** Interface responsiva, com prioridade para tablet. Alvos de toque grandes, poucos campos por tela, foco automático no campo de leitura (o leitor de código de barras digita o valor). Nada de notificações por padrão: no cliente de referência houve **resistência a notificações**.

**8.6 Qualidade e FVM.** O sistema **não** faz checklist nem trata não conformidade. Ele oferece: (a) campo `fvm_number` na entrega e no CUB; (b) bloqueio e liberação manuais pela Qualidade, com motivo; (c) um botão de teste "simular evento da FVM" que bloqueia ou libera um CUB ou lote, só para demonstrar como a integração futura se comportaria.

**8.7 Arquitetura.** Separe em três camadas: **domínio puro** (funções JavaScript (módulos ES) sem React: cálculo do plano de corte, regras de estado do CUB, balanço de massa, validações), **persistência** (um repositório atrás de uma interface, hoje `localStorage`, para poder trocar por um backend depois) e **interface** (React). As regras da seção 5.2 vivem no domínio e têm testes.

**8.8 Importação.** Upload de CSV no navegador, mapeamento de colunas, validação linha a linha e relatório de erros antes de gravar.

---

## 9. Evidências dos dados reais (use como regras de validação e como seed)

Cliente de referência, controle de 2026 (Excel):
- 575 CUBs em 47 lotes (mediana de 11 CUBs por lote, máximo 20).
- Só **50%** dos CUBs têm cadeia completa (lote, NF da usina, NF do prestador e certificado); **63%** não têm peso; 86 CUBs não têm lote. No consolidado de 2024 a 2026, 513 de 826 CUBs não têm certificado válido.
- **94%** dos lotes chegaram em uma NF só e todos com uma única data de recebimento. Mas **35%** das NFs trazem 2 ou 3 lotes. (Por isso entrega e bobina mãe são entidades separadas.)
- **87%** dos CUBs usados têm um único uso; 13% têm de 2 a 4. **9%** passaram por mais de uma obra (até 3).
- Dos 332 registros de consumo, **48 (14%)** não têm CUB válido ("N/D", "SEM CUB") e há lançamentos duplicados (mesmo CUB, obra e data).
- Cruzando CUB com o catálogo: **95%** têm código, galvanização, espessura e largura coerentes; 28 divergem (20 na galvanização, 6 na largura, 2 na espessura) e 4 têm código inválido.

Regras de validação que isso gera:
- Todo CUB precisa de lote, NF do prestador, peso medido e certificado.
- Todo uso precisa de CUB válido e em estoque; alerta de possível duplicidade para o mesmo CUB, OP e dia.
- Ao escolher o material no catálogo, espessura, largura e galvanização vêm do catálogo. A galvanização e a espessura da tira devem bater com as da mãe.
- A importação deve produzir exatamente esse tipo de relatório de inconsistências.

---

## 10. Stack (protótipo)

- **React** com **Vite** e **JavaScript** (JSX), **sem TypeScript**; documente os formatos de dados com JSDoc nos modelos do domínio. Estado com `useReducer` e Context. Estilo com **CSS próprio** e variáveis (tokens de tema), sem framework de UI.
- **Sem backend, sem banco, sem Supabase, sem Vercel.** Estado em `localStorage` e anexos em IndexedDB (ver 8.1).
- Dependências pequenas só quando necessário: **React Router** e uma biblioteca de **QR**. Avise antes de adicionar qualquer outra.
- Testes: **Vitest** para o domínio (plano de corte, estados do CUB, balanço de massa). Sem testes de interface por enquanto.

Design inicial (tokens editáveis): fundo claro, tipografia sans geométrica, paleta de partida derivada do cliente de referência: petróleo `#00212B`, verde-azulado `#276C7A`, laranja de destaque `#F08A3E`, branco gelo `#F1F4F4`. Estética industrial, sóbria, de alta legibilidade em tablet.

---

## 11. Escopo do protótipo v1

**Entregar uma fatia vertical que rode de ponta a ponta no navegador, com dados de exemplo:**

1. Seletor de perfil e permissões simuladas.
2. Cadastros mínimos e catálogo de materiais.
3. Registro de bobina mãe com certificado e NF.
4. Plano de corte com os cálculos da seção 6.
5. Recebimento de entrega, geração de CUBs e etiquetas com QR para impressão.
6. Uso em dois passos, com sobra e consumida.
7. Consulta com ficha da cadeia, recall por lote e balanço de massa.
8. Bloqueio e liberação, com auditoria.

**Critério de aceite (teste de domínio com Vitest, mais um roteiro manual na interface):**
1. Registrar a mãe do lote 8948 (0,95 × 1.200 mm, 12.195 kg, certificado e NF anexados). Tentar registrar sem o certificado é recusado, com a configuração padrão.
2. Plano de 7 × 166 mm → 14 CUBs previstos de ≈ 843,5 kg, refilo de 386,2 kg.
3. Receber a entrega de 14 CUBs com pesos medidos (a contagem declarada precisa bater) e gerar as 14 etiquetas.
4. Abrir o uso de um CUB para a OP X da obra Y; tentar abrir um segundo uso do mesmo CUB e ser recusado.
5. Fechar com sobra de 300 kg (reetiqueta com o mesmo CUB); depois abrir de novo para a obra Z e consumir tudo.
6. A consulta pelo lote 8948 mostra as obras Y e Z, as duas OPs e os consumos; o recall lista os 14 CUBs com saldos; o balanço de massa fecha dentro da tolerância configurada. O certificado abre a partir da ficha de qualquer um dos 14 CUBs.
7. Bloquear o lote impede novos usos e fica registrado na auditoria.

**Fora de escopo:** backend, banco, autenticação real, multiempresa, API, integração com ERP ou FVM, checklist e não conformidade, modo offline, aplicativo nativo, cobrança, leitura de e-mail, cadastro ou usuário do prestador de slitagem.

---

## 12. Pontos em aberto (vamos refinar conversando)

1. Nome do produto e identidade visual.
2. Quem usa o quê: telas por papel e a navegação principal (mobile e desktop).
3. Como o plano de corte é entregue ao prestador (hoje: imprimir ou exportar; e-mail fica fora).
4. Se a etiqueta deve falar direto com a impressora (ZPL) e com a balança, quando houver backend.
5. Granularidade do número de FVM (por entrega ou por bobina) e como será a integração real.
6. Política de retenção e exportação de dados para auditorias.
7. Tolerância do balanço de massa por lote e o que fazer com a diferença.
8. Se a bobina pode ser registrada sem certificado e ter o arquivo anexado depois (padrão do protótipo: não; há uma configuração para permitir).

---

## 13. Glossário

| Termo | Significado | Nome no código |
|---|---|---|
| Bobina mãe | Bobina inteira comprada da usina ou do fornecedor | `MotherCoil` |
| Lote (LS) | Identificador que o prestador de slitagem atribui à bobina mãe; chave da Qualidade | `slitter_lot` |
| Tira / bobina-filha | Resultado do corte; cada uma recebe um CUB | `Coil` |
| CUB | Código Único da Bobina, `CUB-AAAA-NNNNN` | `cub` |
| Slitagem | Corte longitudinal da bobina mãe em tiras | `slitting` |
| Plano de corte | Quantas tiras de que largura saem da mãe | `CuttingPlan` |
| Refilo | Sobra lateral do corte, descartada | `trim` |
| Sobra | O que resta da bobina depois de um uso, com o mesmo CUB | `leftover` |
| OP | Ordem de produção | `ProductionOrder` |
| Perfiladeira | Máquina que conforma a tira em perfil | `Machine` |
| Certificado de qualidade | Documento emitido pela usina que fabricou o aço, por bobina mãe: composição química, propriedades mecânicas, massa de zinco do revestimento (Z275 = 275 g/m²) e dimensões. Prova que o material atende à norma. Aqui: número e arquivo por bobina mãe, herdados por todos os CUBs dela | `certificate_*` |
| FVM | Ferramenta externa do cliente: checklist da bobina e tratamento de não conformidade | `fvm_*` |
| Recall | Levantamento de tudo que foi feito com um lote ou certificado | `recall` |
