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

## Em aberto (padrão adotado até decidirem)

1. Nome do produto: "Bobinas" ao lado da marca SteelCorp.
2. OP = "OP / Protocolo" (campo de texto; o formulário da Produção chama de "Nº protocolo Holmes").
3. `RETURNED` = enviada a terceiros ou devolvida, com destino e motivo.
4. Tolerância do balanço de massa: 1,0% do peso líquido, configurável.
5. Lote bloqueado com CUB montado: o uso aberto termina e a sobra volta `BLOCKED`.
6. Etiqueta: A4 com 2 colunas, e térmica 100×50 mm como opção.
7. Nomes reais de obras e fornecedores dentro do JS publicado: ok só se o portal for interno.
