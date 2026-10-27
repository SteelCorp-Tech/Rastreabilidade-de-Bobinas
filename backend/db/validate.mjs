// Valida db/schema.sql num PostgreSQL embutido (PGlite, PostgreSQL 16): aplica o schema num banco vazio
// e exercita as regras (o que deve passar e o que deve ser recusado) e as views. Ver db/README.md.
//
// O PGlite não é dependência do projeto. Para rodar:
//   cd backend
//   npm install --no-save @electric-sql/pglite@0.2.17
//   npm run validar-schema
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
const db = new PGlite()
let ok = 0
let fail = 0
const pass = (m) => { ok++; console.log('  ok   ' + m) }
const bad = (m) => { fail++; console.log('  FALHA ' + m) }

async function q(text, params) { return (await db.query(text, params)).rows }
async function expectOk(label, text, params) {
  try { const r = await q(text, params); pass(label); return r } catch (e) { bad(`${label}: ${e.message}`) }
}
async function expectError(label, text, pattern, params) {
  try { await q(text, params); bad(`${label}: deveria ter sido recusado`) } catch (e) {
    if (pattern && !pattern.test(e.message)) bad(`${label}: recusado, mas com outra mensagem: ${e.message}`)
    else pass(`${label} (recusado: ${e.message.split('\n')[0]})`)
  }
}

console.log('1. aplicar o schema')
try { await db.exec(sql); pass('schema aplicado sem erro') } catch (e) { bad('schema: ' + e.message); process.exit(1) }
await db.exec('SET search_path TO bobinas, public')

console.log('2. dados de referência')
const [c] = await q(`SELECT (SELECT count(*) FROM role)::int roles, (SELECT count(*) FROM app_action)::int actions,
  (SELECT count(*) FROM app_view)::int views, (SELECT count(*) FROM role_action WHERE role_code='ADMIN')::int admin_actions,
  (SELECT count(*) FROM role_action WHERE role_code='AUDITOR')::int auditor_actions,
  (SELECT last_seq FROM cub_sequence WHERE year=2026) seq, (SELECT weight_limit FROM config) wl, (SELECT trim_min_mm FROM config) tmin`)
JSON.stringify(c) === JSON.stringify({ roles: 7, actions: 16, views: 13, admin_actions: 16, auditor_actions: 0, seq: 575, wl: '700.0', tmin: '14.0' })
  ? pass('perfis, ações, telas, config e numeração: ' + JSON.stringify(c)) : bad('referência: ' + JSON.stringify(c))

console.log('3. fluxo feliz: cadastro → bobina mãe → plano → recebimento → uso')
// db.query aceita um comando por vez; os cadastros vão juntos com exec
await db.exec(`INSERT INTO supplier (name) VALUES ('Fornecedor A'); INSERT INTO mill (name) VALUES ('Usina A');
  INSERT INTO project (name) VALUES ('Obra Y'), ('Obra Z'); INSERT INTO machine (name) VALUES ('Perfiladeira 1');
  INSERT INTO material (erp_code, thickness, width, galvanization) VALUES ('10326', 0.95, 166, 'Z275');`).then(() => pass('cadastros inseridos')).catch((e) => bad('cadastros: ' + e.message))
await expectError('fornecedor repetido (maiúsculas/minúsculas)', `INSERT INTO supplier (name) VALUES ('FORNECEDOR A')`, /supplier_name_uq/)
await expectOk('arquivo do certificado', `INSERT INTO file (id, storage_key, original_name, content_type, size_bytes, sha256, uploaded_by)
  VALUES ('00000000-0000-0000-0000-000000000001', 'cert/1.pdf', 'cert.pdf', 'application/pdf', 1000, repeat('a', 64), 1)`)
await expectOk('certificado', `INSERT INTO certificate (number, file_id, attached_by) VALUES ('7948088101', '00000000-0000-0000-0000-000000000001', 1)`)
await expectOk('bobina mãe', `INSERT INTO mother_coil (slitter_lot, supplier_id, mill_id, supplier_invoice_number, thickness, width, galvanization, net_weight, certificate_id, created_by)
  VALUES ('8948', 1, 1, '213061', 0.95, 1200, 'Z275', 12195, 1, 1)`)
await expectError('lote repetido', `INSERT INTO mother_coil (slitter_lot, supplier_id, supplier_invoice_number, thickness, width, galvanization, net_weight, created_by)
  VALUES ('8948', 1, 'x', 0.95, 1200, 'Z275', 100, 1)`, /mother_coil_slitter_lot_key/)
await expectOk('plano de corte 5×166 + 1×350 (refilo 20 mm)', `INSERT INTO cutting_plan (mother_coil_id, version_no, status, weight_limit_used, used_width, trim_width, trim_weight, utilization_pct, total_cubs, created_by, sent_at)
  VALUES (1, 1, 'SENT', 700, 1180, 20, 203.3, 98.33, 21, 1, now())`)
await expectOk('linhas do plano', `INSERT INTO cutting_plan_line (plan_id, line_no, strip_count, strip_width, strip_weight, coils_per_strip, cubs)
  VALUES (1, 1, 5, 166, 1686.975, 3, 15), (1, 2, 1, 350, 3556.875, 6, 6)`)
await expectError('linha com cubs ≠ tiras × bobinas', `INSERT INTO cutting_plan_line (plan_id, line_no, strip_count, strip_width, strip_weight, coils_per_strip, cubs) VALUES (1, 3, 2, 10, 1, 1, 5)`, /check/i)
await expectError('segundo plano vigente para a mesma mãe', `INSERT INTO cutting_plan (mother_coil_id, version_no, weight_limit_used, used_width, trim_width, trim_weight, utilization_pct, total_cubs, created_by)
  VALUES (1, 2, 700, 1180, 20, 203.3, 98.33, 21, 1)`, /cutting_plan_one_active_uq/)
await expectError('plano SENT sem sent_at', `UPDATE cutting_plan SET sent_at = NULL WHERE id = 1`, /check/i)
await expectOk('entrega', `INSERT INTO delivery (slitter_invoice_number, received_date, declared_coil_count, received_by) VALUES ('14748', '2026-10-26', 2, 1)`)
const [seq] = await q(`SELECT reserve_cub_seq(2026, 2) AS first`)
seq.first === 576 ? pass('reserve_cub_seq(2026, 2) devolve 576') : bad('reserve_cub_seq: ' + JSON.stringify(seq))
const [seq2] = await q(`SELECT reserve_cub_seq(2026, 1) AS first`)
seq2.first === 578 ? pass('a reserva seguinte começa no 578 (sem repetir)') : bad('reserve_cub_seq 2: ' + JSON.stringify(seq2))
const [seq3] = await q(`SELECT reserve_cub_seq(2027, 3) AS first`)
seq3.first === 1 ? pass('ano novo começa no 1') : bad('reserve 2027: ' + JSON.stringify(seq3))
await expectError('reserva com quantidade 0', `SELECT reserve_cub_seq(2026, 0)`, /positivo/)
await expectOk('2 CUBs da entrega', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, material_id, thickness, width, galvanization, received_weight, current_weight)
  VALUES ('CUB-2026-00576', 2026, 576, 1, 1, 1, 0.95, 166, 'Z275', 562.3, 562.3), ('CUB-2026-00577', 2026, 577, 1, 1, 1, 0.95, 166, 'Z275', 562.3, 562.3)`)
await expectError('CUB com galvanização diferente da mãe', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, thickness, width, galvanization, received_weight, current_weight)
  VALUES ('CUB-2026-00590', 2026, 590, 1, 1, 0.95, 166, 'Z350', 500, 500)`, /foreign key/i)
await expectError('CUB com largura diferente do material do catálogo', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, material_id, thickness, width, galvanization, received_weight, current_weight)
  VALUES ('CUB-2026-00591', 2026, 591, 1, 1, 1, 0.95, 170, 'Z275', 500, 500)`, /foreign key/i)
await expectError('texto do CUB não bate com o sequencial', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, thickness, width, galvanization, received_weight, current_weight)
  VALUES ('CUB-2026-00592', 2026, 593, 1, 1, 0.95, 166, 'Z275', 500, 500)`, /check/i)
await expectError('CUB com número repetido', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, thickness, width, galvanization, received_weight, current_weight)
  VALUES ('CUB-2026-00576', 2026, 576, 1, 1, 0.95, 166, 'Z275', 500, 500)`, /coil_cub_key|coil_cub_year_cub_seq_key/)
await expectError('peso atual maior que o recebido', `UPDATE coil SET current_weight = 600 WHERE id = 1`, /check/i)
await expectOk('abrir uso do CUB 576', `INSERT INTO coil_use (coil_id, production_order, project_id, machine_id, weight_before, opened_by) VALUES (1, 'OP-X', 1, 1, 562.3, 1)`)
await expectOk('CUB 576 em uso', `UPDATE coil SET status = 'IN_USE' WHERE id = 1`)
await expectError('segundo uso aberto do mesmo CUB', `INSERT INTO coil_use (coil_id, production_order, project_id, machine_id, weight_before, opened_by) VALUES (1, 'OP-X2', 1, 1, 562.3, 1)`, /em estoque|coil_use_one_open_uq/)
await expectError('fechar com peso final maior que o inicial', `UPDATE coil_use SET weight_after = 600, outcome = 'LEFTOVER', closed_at = now(), closed_by = 1 WHERE id = 1`, /check/i)
await expectError('fechar como sobra com peso 0', `UPDATE coil_use SET weight_after = 0, outcome = 'LEFTOVER', closed_at = now(), closed_by = 1 WHERE id = 1`, /check/i)
await expectOk('fechar com sobra de 300 kg', `UPDATE coil_use SET weight_after = 300, outcome = 'LEFTOVER', closed_at = now(), closed_by = 1 WHERE production_order = 'OP-X'`)
const [cons] = await q(`SELECT consumption, version FROM coil_use WHERE production_order = 'OP-X'`)
cons.consumption === '262.3' && cons.version === 2 ? pass('consumo calculado pelo banco (262,3 kg) e version incrementada') : bad('consumo/version: ' + JSON.stringify(cons))
await expectOk('CUB volta ao estoque com 300 kg', `UPDATE coil SET status = 'IN_STOCK', current_weight = 300 WHERE id = 1`)
await expectOk('abrir de novo para a obra Z', `INSERT INTO coil_use (coil_id, production_order, project_id, machine_id, weight_before, opened_by) VALUES (1, 'OP-Z', 2, 1, 300, 1)`)
await expectOk('consumir tudo', `UPDATE coil_use SET weight_after = 0, outcome = 'CONSUMED', closed_at = now(), closed_by = 1 WHERE production_order = 'OP-Z'`)
await expectError('CUB consumido com peso > 0', `UPDATE coil SET status = 'CONSUMED', current_weight = 10 WHERE id = 1`, /check/i)
await expectOk('CUB consumido com peso 0', `UPDATE coil SET status = 'CONSUMED', current_weight = 0 WHERE id = 1`)
await expectError('abrir uso de CUB consumido', `INSERT INTO coil_use (coil_id, production_order, project_id, machine_id, weight_before, opened_by) VALUES (1, 'OP-W', 1, 1, 1, 1)`, /não está em estoque/)

console.log('4. bloqueio')
await expectError('bloquear lote sem motivo', `UPDATE mother_coil SET blocked_at = now() WHERE id = 1`, /check/i)
await expectOk('bloquear lote com motivo', `UPDATE mother_coil SET blocked_at = now(), blocked_reason = 'Descamação' WHERE id = 1`)
await expectOk('histórico do bloqueio', `INSERT INTO block_event (mother_coil_id, action, reason, by_user) VALUES (1, 'BLOCK', 'Descamação', 1)`)
await expectError('bloqueio sem alvo', `INSERT INTO block_event (action, reason, by_user) VALUES ('BLOCK', 'x', 1)`, /check/i)
await expectError('abrir uso de CUB de lote bloqueado', `INSERT INTO coil_use (coil_id, production_order, project_id, machine_id, weight_before, opened_by) VALUES (2, 'OP-B', 1, 1, 562.3, 1)`, /lote 8948 está bloqueado/)
await expectOk('liberar lote', `UPDATE mother_coil SET blocked_at = NULL, blocked_reason = NULL WHERE id = 1`)

console.log('5. views')
const stock = await expectOk('coil_stock', `SELECT cub, display_status, slitter_lot, supplier, certificate_number, erp_code, use_count, cumulative_consumption, last_project FROM coil_stock ORDER BY cub`)
if (stock) {
  const a = stock[0]
  a.use_count === 2 && a.cumulative_consumption === '562.3' && a.last_project === 'Obra Z' && a.certificate_number === '7948088101'
    ? pass('coil_stock do 576: 2 usos, 562,3 kg consumidos, última obra Z, certificado herdado') : bad('coil_stock 576: ' + JSON.stringify(a))
}
const bal = await expectOk('mother_coil_balance', `SELECT * FROM mother_coil_balance`)
if (bal) console.log('       ' + JSON.stringify(bal[0]))
const sbm = await expectOk('stock_by_material', `SELECT * FROM stock_by_material`)
if (sbm) console.log('       ' + JSON.stringify(sbm))
const lc = await expectOk('lot_consumption', `SELECT slitter_lot, cub, project, production_order, consumption FROM lot_consumption ORDER BY opened_at`)
if (lc) lc.length === 2 && lc[0].project === 'Obra Y' && lc[1].project === 'Obra Z' ? pass('recall do lote 8948: obras Y e Z') : bad('lot_consumption: ' + JSON.stringify(lc))
await expectOk('delivery_lots', `SELECT * FROM delivery_lots`)
await expectOk('mãe sem certificado aparece nas pendências', `INSERT INTO mother_coil (slitter_lot, supplier_id, supplier_invoice_number, thickness, width, galvanization, net_weight, created_by) VALUES ('9000', 1, 'NF9', 0.95, 1200, 'Z275', 5000, 1)`)
const pend = await q(`SELECT slitter_lot, missing_number FROM certificate_pending`)
pend.length === 1 && pend[0].slitter_lot === '9000' ? pass('certificate_pending lista só o lote 9000') : bad('pendências: ' + JSON.stringify(pend))

console.log('6. permissões')
await expectError('conceder ação de administrador ao PCP', `INSERT INTO role_action VALUES ('PCP', 'settings.edit')`, /só do administrador/)
await expectError('dar ação ao auditor', `INSERT INTO role_action VALUES ('AUDITOR', 'block.manage')`, /somente leitura/)
await expectError('tirar permissão do administrador', `DELETE FROM role_action WHERE role_code = 'ADMIN' AND action_code = 'settings.edit'`, /não podem ser alteradas/)
await expectError('dar tela de Permissões à Qualidade', `INSERT INTO role_view VALUES ('QUALIDADE', 'permissions')`, /só do administrador/)
await expectOk('conceder bloqueio à Qualidade', `INSERT INTO role_action VALUES ('QUALIDADE', 'block.manage')`)
await expectOk('restaurar padrão (tirar de novo)', `DELETE FROM role_action WHERE role_code = 'QUALIDADE' AND action_code = 'block.manage'`)

console.log('7. auditoria e exclusões')
await expectOk('registrar evento', `INSERT INTO audit_log (actor_user_id, actor_role, action, entity, entity_id, after) VALUES (1, 'ADMIN', 'lot.block', 'MotherCoil', '1', '{"reason":"x"}')`)
await expectError('alterar auditoria', `UPDATE audit_log SET action = 'x'`, /somente inclusão/)
await expectError('apagar auditoria', `DELETE FROM audit_log`, /somente inclusão/)
await expectError('truncar auditoria', `TRUNCATE audit_log`, /somente inclusão/)
await expectError('excluir recebimento com CUB usado', `DELETE FROM delivery WHERE id = 1`, /foreign key/i)
await expectError('excluir bobina mãe com CUBs', `DELETE FROM mother_coil WHERE id = 1`, /foreign key/i)
await expectOk('recebimento sem uso', `INSERT INTO delivery (slitter_invoice_number, received_date, declared_coil_count, received_by) VALUES ('15000', '2026-10-26', 1, 1)`)
await expectOk('CUB desse recebimento', `INSERT INTO coil (cub, cub_year, cub_seq, mother_coil_id, delivery_id, thickness, width, galvanization, received_weight, current_weight) VALUES ('CUB-2026-00578', 2026, 578, 1, 2, 0.95, 166, 'Z275', 500, 500)`)
await expectOk('excluir recebimento sem uso (CUBs saem junto)', `DELETE FROM delivery WHERE id = 2`)
const [gone] = await q(`SELECT count(*)::int n FROM coil WHERE cub = 'CUB-2026-00578'`)
gone.n === 0 ? pass('CUB do recebimento excluído saiu junto') : bad('CUB ficou: ' + gone.n)
const [nextSeq] = await q(`SELECT reserve_cub_seq(2026, 1) AS first`)
nextSeq.first === 579 ? pass('depois da exclusão, o próximo CUB é 579 (o 578 não volta)') : bad('seq após exclusão: ' + JSON.stringify(nextSeq))
await expectOk('excluir bobina mãe sem CUBs (lote 9000)', `DELETE FROM mother_coil WHERE slitter_lot = '9000'`)

console.log('8. configuração')
await expectError('segunda linha de config', `INSERT INTO config (id) VALUES (2)`, /check/i)
await expectError('refilo mínimo maior que o máximo', `UPDATE config SET trim_min_mm = 40`, /check/i)
await expectOk('desligar a regra de refilo', `UPDATE config SET trim_min_mm = NULL, trim_max_mm = NULL`)

console.log(`\n${ok} verificações ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
