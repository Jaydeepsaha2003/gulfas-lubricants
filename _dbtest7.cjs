/* Integration test: items_text in sale/purchase lists + inventory.lots voucher breakdown. */
const path = require('path')
const os = require('os')
const fs = require('fs')
const esbuild = require('esbuild')

const tmpDir = path.join(os.tmpdir(), 'gulfas-test7-' + process.pid)
fs.mkdirSync(tmpDir, { recursive: true })
const outFile = path.join(__dirname, '_db.bundle7.cjs')

const electronStub = {
  name: 'electron-stub',
  setup(build) {
    build.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'estub' }))
    build.onLoad({ filter: /.*/, namespace: 'estub' }, () => ({
      contents: `exports.app = { getPath: () => ${JSON.stringify(tmpDir)} };`, loader: 'js'
    }))
  }
}

let failures = 0
const approx = (a, b) => Math.abs(a - b) < 0.01
function check(label, got, want) {
  const ok = typeof want === 'number' ? approx(got, want) : got === want
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  =>  got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}
function assert(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
}

async function main() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/main/db.ts')],
    bundle: true, platform: 'node', format: 'cjs', outfile: outFile,
    external: ['sql.js'], plugins: [electronStub], logLevel: 'error'
  })
  const db = require(outFile)
  await db.initDb()
  const { companyRepo, unitRepo, productRepo, recipeRepo, vendorRepo, customerRepo, purchaseRepo, productionRepo, saleRepo, inventoryRepo } = db

  companyRepo.save({ ...companyRepo.get(), state_code: '27', gst_pricing_mode: 'EXCLUSIVE' })
  const pcs = unitRepo.list().find((u) => u.name === 'PCS').id
  const party = (o) => ({ address: '', city: '', state: '', phone: '', email: '', is_active: 1, ...o })
  const vendor = vendorRepo.create(party({ code: 'VEN-0001', name: 'OIL SUPPLIER', gst_registered: 1, gstin: '27AAAAA0000A1Z5', state_code: '27' }))
  const cust = customerRepo.create(party({ code: 'CUS-0001', name: 'GARAGE', gst_registered: 0, gstin: '', state_code: '27' }))

  const baseOil = productRepo.create({ code: 'RM-0001', name: 'BASE OIL', type: 'RAW', category_id: null, unit_id: pcs, hsn_code: '2710', gst_rate: 18, purchase_price: 50, sale_price: 0, reorder_level: 0, recipe_output_qty: 1, units_per_box: 1 })
  const fg = productRepo.create({ code: 'FG-0001', name: 'ENGINE OIL 1L', type: 'FINISHED', category_id: null, unit_id: pcs, hsn_code: '2710', gst_rate: 18, purchase_price: 0, sale_price: 250, reorder_level: 0, recipe_output_qty: 1, units_per_box: 12 })
  recipeRepo.save(fg.id, [{ component_product_id: baseOil.id, quantity: 2 }])

  purchaseRepo.create({ voucher_no: 'PUR-0001', purchase_date: '2026-03-01', vendor_id: vendor.id, gst_pricing_mode: 'EXCLUSIVE', items: [{ product_id: baseOil.id, quantity: 100, rate: 50, gst_rate: 18 }] })
  productionRepo.create({ voucher_no: 'PRD-0001', production_date: '2026-03-02', product_id: fg.id, output_qty: 10 })
  saleRepo.create({ invoice_no: 'INV-0001', sale_date: '2026-03-03', customer_id: cust.id, gst_pricing_mode: 'EXCLUSIVE', items: [{ product_id: fg.id, quantity: 5, rate: 250, gst_rate: 18, uom: 'EACH' }] })

  // ---- items_text in list queries (powers the search bar) ----
  const purList = purchaseRepo.list()
  assert('purchase list carries items_text', (purList[0].items_text || '').includes('BASE OIL'))
  const saleList = saleRepo.list()
  assert('sale list carries items_text', (saleList[0].items_text || '').includes('ENGINE OIL'))

  // ---- inventory.lots: which voucher the available stock came from ----
  const rmLots = inventoryRepo.lots(baseOil.id)
  check('BASE OIL has 1 available lot', rmLots.length, 1)
  check('BASE OIL lot source', rmLots[0].source_type, 'PURCHASE')
  check('BASE OIL lot voucher', rmLots[0].voucher_no, 'PUR-0001')
  check('BASE OIL lot party', rmLots[0].party_name, 'OIL SUPPLIER')
  check('BASE OIL lot remaining (100-20)', rmLots[0].qty_remaining, 80)
  check('BASE OIL lot value (80x50)', rmLots[0].value, 4000)

  const fgLots = inventoryRepo.lots(fg.id)
  check('FG has 1 available lot', fgLots.length, 1)
  check('FG lot source', fgLots[0].source_type, 'PRODUCTION')
  check('FG lot voucher', fgLots[0].voucher_no, 'PRD-0001')
  check('FG lot remaining (10-5)', fgLots[0].qty_remaining, 5)
  check('FG lot value (5x100)', fgLots[0].value, 500)

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`))
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(outFile, { force: true }) } catch {}
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
