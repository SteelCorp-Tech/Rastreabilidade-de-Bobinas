# DECISIONS.md

Decisões do projeto, com motivo e data. Atualize junto com o `CLAUDE.md`.

## 2026-10-20

| Decisão | Motivo |
|---|---|
| Hospedagem como **página própria** no portal SteelApps, com menu lateral próprio. Build estático, `base: './'`, `HashRouter`. | Tablet precisa da tela inteira; roda em qualquer subpasta sem configurar o servidor. |
| Chaves de armazenamento com prefixo `bobinas:v1:`. | Evita colidir com outros apps do mesmo domínio. |
| Leitura de QR pela **câmera do tablet** (biblioteca `barcode-detector`, entra no incremento 7), mantendo o campo com foco automático para leitor físico. | Escolha do dono do produto. A câmera exige HTTPS no portal. |
| **Seed com dados reais**, gerado do Excel por script, com tabela explícita de normalização de nomes. | Escolha do dono do produto. O lote 8948 fica fora do seed para o roteiro de aceite registrá-lo do zero. |
| **Git local**, um commit por incremento, sem remoto. `*.xlsx` fora do git. | Facilita voltar atrás e revisar cada ciclo. |
| Persistência: dados em `localStorage`, anexos em **IndexedDB**. | Um PDF não cabe nos ~5 MB do `localStorage`. Corrige a seção 10 do CLAUDE.md, que dizia "só localStorage". |
| Gravações passam por um **executor de comandos** com trava entre abas (`navigator.locks`), releitura do storage e aviso por evento `storage`. | "Ler o último número na hora de gravar" não evita que uma aba sobrescreva o que a outra gravou. |
| Cálculo com precisão total, arredondamento só na exibição. Tira do lote 8948 = **1.687,0 kg** (1.686,975), não 1.686,9. | Aritmética: 12.195 × 166 / 1.200. |
| Importação CSV fica **depois da fatia v1**; o catálogo e o estoque iniciais entram pelo seed. | Não consta na fatia da seção 11. |
| Seletor de perfil no **rodapé do menu**, como no portal. | Espelha o padrão do SteelApps (CLAUDE.md dizia "no topo"). |
| Prestador de slitagem nos dados: **SENASERV** (lote LS, OP SENASERV, NF SENASERV). Catálogo = aba CÓD MICROSYS. Perfiladeiras: FRAMECAD 90, FRAMECAD 150, PINNACLE X3. | Vindo do Excel real. |
| Identidade visual derivada do print do SteelApps: petróleo `#00212B`, teal `#276C7A`, laranja `#F08A3E`, gelo `#F1F4F4`, Montserrat e JetBrains Mono. Vermelho `#C0392B` só para "bloqueado". | Print enviado pelo dono do produto. |
| Campos das entidades em `snake_case` (como no CLAUDE.md e no glossário); funções e parâmetros em `camelCase`. | Casa com o modelo do cliente e com o futuro backend. |
| Domínio é um conjunto de comandos puros `(state, input, ctx) → {state, result}`; a persistência só chama isso dentro da trava entre abas. | Testável sem navegador e trocável por backend. |
| Lote do prestador é único entre as mães. | Chave da Qualidade; no Excel real nenhum lote tem mais de um fornecedor. |
| Seed = lotes do controle 2026 que constam na aba de estoque (têm peso e largura da mãe), mais os lotes ainda no prestador. Pesos dos CUBs estimados pela fórmula do plano de corte (marcados `received_weight_estimated`); usos sem OP viram "SEM OP" e perfiladeira "N/D". | O Excel não tem peso da mãe para 20 dos 49 lotes, e os pesos por CUB são rateio. |
| Piso de numeração `cub_floor` (2026: 575): o sistema emite CUBs a partir do 576. | Os CUBs físicos do Excel (inclusive de lotes fora do seed) já estão colados nas tiras; não podem se repetir. |
| Restaurar dados de exemplo preserva o AuditLog e registra `seed.restore`. | Auditoria só cresce. |
| Cadastros só se inativam (nunca se apagam); nome único sem diferenciar maiúsculas; catálogo único por (espessura, largura, galvanização). Edição: Suprimentos e Administrador; configurações: só Administrador. | CLAUDE.md 8.3 e 8.2. |
| Configuração `label_layout` (A4 2 colunas ou térmica 100×50 mm). | Pergunta em aberto 6: o padrão é A4 como a planilha de hoje. |
| Plano de corte: salvar um **rascunho** o atualiza no lugar; só um plano **enviado** gera nova versão (a anterior vira "Substituído"). | Evita dezenas de versões por edição; versões marcam o que foi realmente enviado ao prestador. |
| Etiqueta mantém os campos da etiqueta de hoje (CUB, lote LS, código Microsys, fornecedor, galvanização, dimensão, NF fornecedor, NF prestador, data, certificado) e acrescenta QR (o CUB) e peso medido. Sobra: mesma etiqueta com "SOBRA", novo peso e data. | Continuidade com o chão de fábrica; CLAUDE.md 8.4. |
| Posição no estoque editável por Almoxarifado e Produção (`stock.locate`), com auditoria. | CLAUDE.md 7.5. |
| Uso: ler um CUB em uso leva direto ao passo 2; CUB bloqueado, consumido ou enviado é recusado com o motivo. Última perfiladeira usada fica lembrada no tablet (`bobinas:v1:last-use`). Diferença de espessura além de ±0,05 mm só alerta (não bloqueia). | Poucos toques no chão de fábrica; a regra de recusa é do domínio. |
| Câmera: `barcode-detector` (leitor nativo do navegador quando existe; senão ZXing-WASM local, ~0,9 MB, só carregado quando precisa). `dev:https` para testar a câmera no tablet. | Safari/iPad não tem leitor nativo; sem CDN, funciona offline. |
| Bloqueio de lote: bloqueia a mãe e todos os CUBs com saldo; CUB em uso bloqueia ao fechar o uso (a sobra volta `BLOCKED`); liberar o lote só desfaz o que o lote bloqueou. Motivo obrigatório em ambos. | Pergunta em aberto 5; CLAUDE.md 5.2 e 7.9. |
| Dossiês (lote e obra) e recall exportam CSV no padrão Excel pt-BR (`;`, vírgula decimal, BOM). | Quem recebe a auditoria abre no Excel. |
| "Simular evento da FVM" reaproveita os comandos de bloqueio e liberação com o motivo "Evento FVM (simulado) nº …". | CLAUDE.md 8.6c; só demonstração. |
| Etiqueta redesenhada no **modelo da etiqueta do Excel** (aba "Gerador de etiqueta"): logo SteelCorp no topo, símbolo como marca d'água, CUB e lote em destaque, campos em dois blocos (esquerda: código Microsys, galvanização, dimensão, data de recebimento; direita: fornecedor, NF fornecedor, NF prestador, certificado). O Excel **não tem QR**; o QR do CUB e o peso medido foram encaixados no layout. Logos copiados do próprio Excel (`src/assets/`). | Pedido do dono do produto em 20/10/2026: continuidade visual com a etiqueta de hoje. |
| Layout de altura fixa: a janela não rola; só a área de conteúdo (`.main`) rola, o menu fica parado e a rolagem volta ao topo ao trocar de tela. Na impressão o layout volta a fluir normalmente. | Pedido do dono do produto em 21/10/2026. |
| Telas de lista (Bobinas mãe, Plano de corte, Recebimento, Estoque, Cadastros, Auditoria, Balanço e Pendências do Recall): título, abas e filtros ficam parados e a **tabela** ocupa o resto da janela, com rolagem própria e cabeçalho fixo (classes `fit-page` e `fill`). Telas com várias seções (ficha, dossiê, levantamento do Recall) rolam a área de conteúdo inteira. | Pedido do dono do produto em 21/10/2026. |
| Telas de lista em janela baixa ou estreita: a tabela tem altura mínima (a página `fit-page` tem 540 px no mínimo) e, se a janela for menor que isso, a área de conteúdo inteira volta a rolar. | Evita tabela espremida ou fora da tela sem como rolar (21/10/2026). |
| Tabelas de lista com **colunas ordenáveis**: clicar no nome da coluna ordena crescente, de novo decrescente (seta ▲/▼ na coluna ativa). Números ordenam como números, textos em ordem natural pt-BR (lote 9843 antes de 10001), vazios vão sempre para o fim. Sem clique, vale a ordem padrão de cada tela. | Pedido do dono do produto em 21/10/2026. |
| Manual do usuário em HTML e PDF, com 65 prints gerados por script (setas numeradas desenhadas sobre a tela real, legenda vinda do mesmo roteiro). Janela de captura 1280 × 800. | Pedido do dono do produto em 21/10/2026: manual completo com prints e setas. |
| Ajustes de layout feitos ao montar o manual: resultado do plano de corte e tabelas de lista passam a caber em janelas de ~1280 px (sem esconder colunas nem quebrar CUB e material em várias linhas). | O manual revelou conteúdo cortado em 1280 px. |

### 21/10/2026 — Novo padrão visual dos apps (referência: app "GT Tecnologia")
- Menu lateral claro (branco) com o logo do Grupo SteelCorp, rótulo de seção, item ativo em cinza com barra escura à esquerda e "Recolher menu" no rodapé; barra superior com o título da tela e o seletor de perfil (antes no rodapé do menu); fundo branco; cartões em cinza-gelo, sem borda e sem sombra.
- Fonte: Inter quando instalada, senão a do sistema (sem adicionar dependência). Etiquetas continuam em Montserrat.
- Tema escuro: botão (sol/lua) na barra superior; a escolha fica em `bobinas:v1:theme`, e sem escolha segue o tema do sistema. Só vale na tela: etiquetas, planos e dossiês impressos continuam claros. Cores do app agora são variáveis (`--fundo`, `--campo`, `--titulo`, `--acao` etc. em tokens.css).
- Sem botão "Sair": o protótipo não tem login.
- Os prints do manual do usuário ainda mostram o visual anterior; regerar com `npm run manual:capture`, `manual:build` e `manual:pdf`.

## Em aberto (padrão adotado até decidirem)

1. Nome do produto: "Bobinas" ao lado da marca SteelCorp.
2. OP = "OP / Protocolo" (campo de texto; o formulário da Produção chama de "Nº protocolo Holmes").
3. `RETURNED` = enviada a terceiros ou devolvida, com destino e motivo.
4. Tolerância do balanço de massa: 1,0% do peso líquido, configurável.
5. Lote bloqueado com CUB montado: o uso aberto termina e a sobra volta `BLOCKED`.
6. Etiqueta: A4 com 2 colunas, e térmica 100×50 mm como opção.
7. Nomes reais de obras e fornecedores dentro do JS publicado: ok só se o portal for interno.
8. Dois planos de corte para a mesma bobina mãe (duas passadas, cada uma com uma parte do peso) — 21/10/2026. Hoje há um plano vigente por mãe; versões são só histórico. Nada foi alterado. A proposta (várias passadas por mãe, cada uma com nome, peso em kg, linhas, status e versões; refilo e balanço somando as passadas; soma dos pesos ≤ peso líquido) aguarda validação com a operação. Perguntas: (a) dividir por kg ou por %; (b) enviar as passadas juntas ou cada uma separada.
