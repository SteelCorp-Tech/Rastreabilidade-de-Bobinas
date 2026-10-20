# Relatório do seed

Gerado de `CONTROLE_RASTREABILIDADE_BOBINAS_A29.xlsx` por `npm run seed`. Não editar à mão.

## Resumo

- Bobinas mãe: **45** (27 com CUBs; 18 ainda no prestador)
- CUBs: **261** · entregas: 18 · planos de corte: 22 · usos: 64
- Cadastros: 5 fornecedores, 1 usinas, 15 obras, 3 perfiladeiras, 161 linhas de catálogo
- Piso de numeração de CUB 2026: **575** (o próximo CUB emitido pelo sistema será 576)
- Critério da amostra: lotes do controle 2026 que também constam na aba de estoque (têm peso e largura da mãe). Ficaram de fora 20 lotes e 61 CUBs sem lote.

## Lotes de fora do seed

| Lote | CUBs | Motivo |
|---|---|---|
| 9700 | 20 | sem peso e largura da bobina mãe |
| 8943 | 15 | sem peso e largura da bobina mãe |
| 8957 | 16 | sem peso e largura da bobina mãe |
| 9702 | 18 | sem peso e largura da bobina mãe |
| 9760 | 18 | sem peso e largura da bobina mãe |
| 8583 | 14 | sem peso e largura da bobina mãe |
| 8947 | 8 | sem peso e largura da bobina mãe |
| 9783 | 5 | sem peso e largura da bobina mãe |
| 9784 | 5 | sem peso e largura da bobina mãe |
| 9773 | 12 | sem peso e largura da bobina mãe |
| 9804 | 14 | sem peso e largura da bobina mãe |
| 9780 | 7 | sem peso e largura da bobina mãe |
| 9782 | 6 | sem peso e largura da bobina mãe |
| 9787 | 6 | sem peso e largura da bobina mãe |
| 9815 | 12 | sem peso e largura da bobina mãe |
| 9816 | 14 | sem peso e largura da bobina mãe |
| 9817 | 17 | sem peso e largura da bobina mãe |
| 8948 | 14 | reservado para o roteiro de aceite |
| 10028 | 14 | sem peso e largura da bobina mãe |
| 10034 | 18 | sem peso e largura da bobina mãe |

## Tabela de normalização

### Fornecedor

| No Excel | Fornecedor | Usina |
|---|---|---|
| ARCELOMITAL | ARCELORMITTAL | ARCELORMITTAL |
| ARCELORMITTAL | ARCELORMITTAL | ARCELORMITTAL |
| AMAFER | AMAFER | — |
| MVAL - CSN | MVAL | CSN |
| MVAL | MVAL | — |
| CSN | CSN | CSN |
| USIMINAS | USIMINAS | USIMINAS |
| MALTA RIO | MALTA RIO | — |
| PERF NARDI | PERF NARDI | — |
| BOX STEEL | BOX STEEL | — |

### Obra

| No Excel | No app |
|---|---|
| AUDITORIO SAO JOSE | AUDITÓRIO SÃO JOSÉ |
| SALTO PIRAPORA | SALTO DE PIRAPORA |
| ESCOLA RIBEIRÃO | ESCOLA RIBEIRÃO PRETO |
| ESCOLA RIBEIRÃO 2 | ESCOLA RIBEIRÃO PRETO 2 |
| (espaços duplos, ex.: "CDHU  1º PAV") | espaços colapsados |
| TESTE, PRIMEIRO PV TESTE, PRIMEIRO PV (3) TESTE, Z 350 | **descartadas** (lançamentos de teste: 4 linhas) |

## Inconsistências encontradas

### Fornecedor normalizado (1)

- "MVAL - CSN" → MVAL (usina CSN)

### Pesos da planilha (rateio) substituídos pela fórmula correta (15)

- lote 9872: 6 CUBs
- lote 9874: 6 CUBs
- lote 9875: 6 CUBs
- lote 9880: 5 CUBs
- lote 9871: 7 CUBs
- lote 9899: 10 CUBs
- lote 9900: 12 CUBs
- lote 9873: 5 CUBs
- lote 9879: 6 CUBs
- lote 9906: 12 CUBs
- lote 10001: 8 CUBs
- lote 9885: 14 CUBs
- lote 10011: 16 CUBs
- lote 10012: 12 CUBs
- lote 9849: 11 CUBs

### Bobinas mãe sem certificado (35)

- lote 9842
- lote 9774
- lote 9884
- lote 9971
- lote 9843
- lote 9973
- lote 10009
- lote 10008
- lote 10010
- lote 9891
- lote 9892
- lote 9999
- lote 10001
- lote 9885
- lote 10011
- lote 10012
- lote 9849
- lote 8314 (no prestador, REGISTERED)
- lote 8315 (no prestador, REGISTERED)
- lote 9850 (no prestador, REGISTERED)
- lote 9851 (no prestador, REGISTERED)
- lote 9870 (no prestador, REGISTERED)
- lote 9876 (no prestador, REGISTERED)
- lote 9877 (no prestador, REGISTERED)
- lote 9893 (no prestador, REGISTERED)
- lote 9972 (no prestador, REGISTERED)
- lote 9997 (no prestador, REGISTERED)
- lote 9998 (no prestador, REGISTERED)
- lote 10000 (no prestador, REGISTERED)
- lote 10003 (no prestador, REGISTERED)
- lote 10004 (no prestador, REGISTERED)
- lote 10005 (no prestador, REGISTERED)
- lote 10006 (no prestador, REGISTERED)
- lote 10007 (no prestador, REGISTERED)
- lote 10013 (no prestador, REGISTERED)

### CUB sem NF do prestador (12)

- CUB-2026-00336
- CUB-2026-00337
- CUB-2026-00338
- CUB-2026-00339
- CUB-2026-00340
- CUB-2026-00341
- CUB-2026-00342
- CUB-2026-00343
- CUB-2026-00344
- CUB-2026-00345
- CUB-2026-00346
- CUB-2026-00347

### Código ERP do CUB diverge do catálogo (28)

- CUB-2026-00349: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00350: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00351: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00352: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00353: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00354: planilha 10341 × catálogo 10345 (0,95x241 Z275)
- CUB-2026-00359: planilha 10339 × catálogo 10326 (0,80X181 Z275)
- CUB-2026-00360: planilha 10339 × catálogo 10326 (0,80X181 Z275)
- CUB-2026-00514: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00515: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00516: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00517: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00518: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00525: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00536: planilha 10340 × catálogo 10339 (0,95x181 Z275)
- CUB-2026-00537: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00538: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00539: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00540: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00541: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00542: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00543: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00544: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00545: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00546: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00547: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00548: planilha 10340 × catálogo 10339 (0,95X181 Z275)
- CUB-2026-00549: planilha 10340 × catálogo 10339 (0,95X181 Z275)

### Espessura da mãe (aba de estoque) diverge da dos CUBs (1)

- lote 9971: estoque 1,255x1200 × CUB 0,80X181 → usei 0.8 mm

### Fornecedor diverge entre o controle e a aba de estoque (3)

- lote 9971: controle "AMAFER" × estoque "PERF NARDI" → usei o do controle
- lote 9973: controle "AMAFER" × estoque "PERF NARDI" → usei o do controle
- lote 9999: controle "BOX STEEL" × estoque "AMAFER" → usei o do controle

### Plano de corte não pôde ser derivado dos CUBs (5)

- lote 9971: A largura utilizada (1568 mm) passa da largura da bobina mãe (1200 mm).
- lote 10009: A largura utilizada (1648 mm) passa da largura da bobina mãe (1200 mm).
- lote 10010: A largura utilizada (1286 mm) passa da largura da bobina mãe (1200 mm).
- lote 9891: A largura utilizada (1286 mm) passa da largura da bobina mãe (1200 mm).
- lote 10011: A largura utilizada (1526 mm) passa da largura da bobina mãe (1200 mm).

### CUB com espessura ou galvanização diferente da mãe (14)

- CUB-2026-00361: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00362: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00363: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00364: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00365: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00366: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00367: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00368: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00369: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00370: 1,25X181 Z275 × mãe 0.8 Z275
- CUB-2026-00387: 1,25x241 Z275 × mãe 0.8 Z275
- CUB-2026-00388: 1,25x241 Z275 × mãe 0.8 Z275
- CUB-2026-00389: 1,25x241 Z275 × mãe 0.8 Z275
- CUB-2026-00390: 1,25x241 Z275 × mãe 0.8 Z275

### Obra normalizada (4)

- "AUDITORIO SAO JOSE" → AUDITÓRIO SÃO JOSÉ
- "SALTO PIRAPORA" → SALTO DE PIRAPORA
- "ESCOLA RIBEIRÃO" → ESCOLA RIBEIRÃO PRETO
- "ESCOLA RIBEIRÃO 2" → ESCOLA RIBEIRÃO PRETO 2

### Uso sem CUB válido (descartado) (27)

- GINÁSIO RIBEIRÃO 2: "N/D"
- GINÁSIO RIBEIRÃO 1: "N/D"
- GINÁSIO RIBEIRÃO 1: "LS 8944"
- PPP ITAPETININGA: "0,80X181"
- PPP ITAPETININGA: "OP 13774"
- PPP ITAPETININGA: "OP 13772"
- PPP ITAPETININGA: "LS 8944"
- PPP ITAPETININGA: "?"
- GINÁSIO ARARAS: "N/D"
- GINÁSIO SERTÃOZINHO: "LS 9760"
- AUDITÓRIO SÃO JOSÉ: "LS 9760"
- PPP SALTO DE PIRAPORA: "N/D"
- GINÁSIO OLIMPIA: "N/D"
- CDHU 2º PAV - BLOCO B: "N/D"
- AUDITÓRIO RIBEIRÃO 2: "N/D"
- CDHU TÉRREO - BLOCO B: "N/D"
- GINÁSIO SÃO JOSÉ: "N/D"
- AUDITÓRIO OLIMPIA: "N/D"
- AUDITÓRIO SERTÃOZINHO: "N/D"
- CUB-2026-00272 · AUDITÓRIO JARDINÓPOLIS
- VILA STEEL: "SEM CUB"
- ESCOLA RIBEIRÃO PRETO: "SEM CUB"
- ITAPETININGA: "SEM CUB"
- SALTO DE PIRAPORA: "SEM CUB"
- CDHU PAV INF: "SEM CUB"
- CUB-2026-00320
- 64 usos

### Lançamento duplicado (mesmo CUB, obra e data): mantido um só (2)

- CUB-2026-00263|AUDITÓRIO OLIMPIA|2026-03-24
- CUB-2026-00272|AUDITÓRIO JARDINÓPOLIS|2026-03-24

### Nome de obra possivelmente digitado de dois jeitos (mantido como está) (7)

- MVP JBJ
- CUB-2026-00306
- CUB-2026-00289
- CUB-2026-00305
- CUB-2026-00310
- CUB-2026-00316
- CUB-2026-00317

### Balanço de massa fora da tolerância de 1% (estimativa a partir dos CUBs recebidos) (8)

- lote 9899: líquido 11550, CUBs 7927.8, refilo 2849, diferença 773.2 kg
- lote 9900: líquido 10180, CUBs 9040, refilo 458.1, diferença 681.9 kg
- lote 9842: líquido 9840, CUBs 8230, refilo 803.6, diferença 806.4 kg
- lote 9884: líquido 15140, CUBs 7606, refilo 6775.2, diferença 758.9 kg
- lote 10008: líquido 8310, CUBs 7025.3, refilo 657.9, diferença 626.8 kg
- lote 9892: líquido 7015, CUBs 2645, refilo 3840.7, diferença 529.3 kg
- lote 10012: líquido 10730, CUBs 9528.6, refilo 482.9, diferença 718.6 kg
- lote 9849: líquido 9990, CUBs 8683.3, refilo 424.6, diferença 882.1 kg

## Balanço de massa por lote (estimativa)

| Lote | Líquido (kg) | CUBs (kg) | Refilo (kg) | Diferença (kg) | 1% |
|---|---|---|---|---|---|
| 9872 | 3035 | 2898.5 | 136.6 | -0.1 | ok |
| 9874 | 4070 | 3886.9 | 183.2 | -0.1 | ok |
| 9875 | 4075 | 3891.4 | 183.4 | 0.2 | ok |
| 9880 | 4300 | 4103 | 197.1 | -0.1 | ok |
| 9871 | 5735 | 5553.1 | 181.6 | 0.3 | ok |
| 9899 | 11550 | 7927.8 | 2849 | 773.2 | fora |
| 9900 | 10180 | 9040 | 458.1 | 681.9 | fora |
| 9873 | 2985 | 2848.2 | 136.8 | 0 | ok |
| 9879 | 4280 | 4087.6 | 192.6 | -0.2 | ok |
| 9906 | 7735 | 7289.8 | 444.8 | 0.4 | ok |
| 9842 | 9840 | 8230 | 803.6 | 806.4 | fora |
| 9774 | 11745 | 11548.8 | 195.8 | 0.5 | ok |
| 9884 | 15140 | 7606 | 6775.2 | 758.9 | fora |
| 9971 | 6935 | 6934.4 | 0 | 0.6 | ok |
| 9843 | 9890 | 8209.2 | 1681.3 | -0.5 | ok |
| 9973 | 10180 | 3800.4 | 6379.5 | 0.1 | ok |
| 10009 | 8680 | 8680.2 | 0 | -0.2 | ok |
| 10008 | 8310 | 7025.3 | 657.9 | 626.8 | fora |
| 10010 | 7820 | 7820.4 | 0 | -0.4 | ok |
| 9891 | 5395 | 5395.2 | 0 | -0.2 | ok |
| 9892 | 7015 | 2645 | 3840.7 | 529.3 | fora |
| 9999 | 4955 | 4830.9 | 123.9 | 0.2 | ok |
| 10001 | 9880 | 7442.8 | 2437.1 | 0.1 | ok |
| 9885 | 14610 | 9545.6 | 5125.7 | -61.3 | ok |
| 10011 | 10415 | 10414.4 | 0 | 0.6 | ok |
| 10012 | 10730 | 9528.6 | 482.9 | 718.6 | fora |
| 9849 | 9990 | 8683.3 | 424.6 | 882.1 | fora |
