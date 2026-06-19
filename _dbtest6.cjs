/* Integration test: product categories, P&L (purchases/production/stock),
   delete-data scope, and DB-location switching. Electron is stubbed. */
const path = require('path')
const os = require('os')
const fs = require('fs')
const esbuild = require('esbuild')

const tmpDir = path.join(os.tmpdir(), 'gulfas-test6-' + process.pid)
fs.mkdirSync(tmpDir, { recursive: true })
const outFile = path.join(__dirname, '_db.bundle6.cjs')

const electronStub = {
  name: 'electron-stub',
  setup(build) {
    build.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'estub' }))
    build.onLoad({ filter: /.*/, namespace: 'estub' }, () => ({
      contents: `exports.app = { getPath: () => ${JSON.stringify(tmpDir)} };`,
      loader: 'js'
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
  const {
    companyRepo, unitRepo, productRepo, productCategoryRepo, recipeRepo,
    vendorRepo, customerRepo, openingStockRepo, purchaseRepo, productionRepo,
    saleRepo, reportRepo, getDbInfo, setDbLocation, resetDbLocation, resetData
  } = db

  // ---- 1. Product categories ----
  const cats = productCategoryRepo.list()
  assert('seeded categories include OIL', cats.some((c) => c.name === 'OIL'))
  assert('seeded categories include BOTTLE & SEAL', cats.some((c) => c.name === 'BOTTLE') && cats.some((c) => c.name === 'SEAL'))
  const oilId = cats.find((c) => c.name === 'OIL').id
  const added = productCategoryRepo.create('ADDITIVE')
  assert('create category returns row', !!added && added.name === 'ADDITIVE')

  const pcs = unitRepo.list().find((u) => u.name === 'PCS').id
  const baseOil = productRepo.create({
    code: 'RM-0001', name: 'BASE OIL', type: 'RAW', category_id: oilId, unit_id: pcs,
    hsn_code: '2710', gst_rate: 18, purchase_price: 50, sale_price: 0, reorder_level: 0,
    recipe_output_qty: 1, units_per_box: 1
  })
  check('product stores category_name', baseOil.category_name, 'OIL')
  assert('products.list(RAW) carries category_name', productRepo.list('RAW').find((p) => p.id === baseOil.id).category_name === 'OIL')

  const fg = productRepo.create({
    code: 'FG-0001', name: 'ENGINE OIL 1L', type: 'FINISHED', category_id: oilId, unit_id: pcs,
    hsn_code: '2710', gst_rate: 18, purchase_price: 0, sale_price: 250, reorder_level: 0,
    recipe_output_qty: 1, units_per_box: 12
  })
  recipeRepo.save(fg.id, [{ component_product_id: baseOil.id, quantity: 2 }])

  // ---- 2. P&L figures: purchases / production cost / sales / stock in hand ----
  companyRepo.save({ ...companyRepo.get(), state_code: '27', gst_pricing_mode: 'EXCLUSIVE' })
  const party = (o) => ({ address: '', city: '', state: '', phone: '', email: '', is_active: 1, ...o })
  const vendor = vendorRepo.create(party({ code: 'VEN-0001', name: 'OIL SUPPLIER', gst_registered: 1, gstin: '27AAAAA0000A1Z5', state_code: '27' }))
  const cust = customerRepo.create(party({ code: 'CUS-0001', name: 'GARAGE', gst_registered: 0, gstin: '', state_code: '27' }))

  // Buy 100 BASE OIL @ 50 (taxable 5000) → stock 100 @ 50
  purchaseRepo.create({
    voucher_no: 'PUR-0001', purchase_date: '2026-03-01', vendor_id: vendor.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: baseOil.id, quantity: 100, rate: 50, gst_rate: 18 }]
  })
  // Produce 10 FG → consumes 20 BASE OIL @50 = 1000; FG 10 @ unit cost 100
  productionRepo.create({ voucher_no: 'PRD-0001', production_date: '2026-03-02', product_id: fg.id, output_qty: 10 })
  // Sell 5 FG @ 250 → taxable 1250, cogs 5*100 = 500
  saleRepo.create({
    invoice_no: 'INV-0001', sale_date: '2026-03-03', customer_id: cust.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: fg.id, quantity: 5, rate: 250, gst_rate: 18, uom: 'EACH' }]
  })

  const pnl = reportRepo.pnl('0001-01-01', '9999-12-31')
  check('P&L purchases', pnl.purchases_total, 5000)
  check('P&L production cost', pnl.production_cost, 1000)
  check('P&L sales (revenue)', pnl.revenue, 1250)
  check('P&L stock in hand (80x50 + 5x100)', pnl.stock_in_hand, 4500)
  check('P&L cogs', pnl.cogs, 500)
  check('P&L gross profit', pnl.gross_profit, 750)
  check('P&L net profit (no expenses)', pnl.net_profit, 750)

  const dash = reportRepo.dashboard('0001-01-01', '9999-12-31')
  check('dashboard production_cost', dash.kpis.production_cost, 1000)
  check('dashboard stock_in_hand', dash.kpis.stock_in_hand, 4500)
  check('dashboard purchases_total', dash.kpis.purchases_total, 5000)

  // ---- 3. DB location switching ----
  const info0 = getDbInfo()
  assert('starts at default location', info0.isDefault === true)
  const extDir = path.join(tmpDir, 'gdrive')
  const newPath = setDbLocation(extDir)
  assert('setDbLocation writes file to new dir', fs.existsSync(newPath) && newPath.startsWith(extDir))
  assert('getDbInfo reflects custom location', getDbInfo().isDefault === false && getDbInfo().path === newPath)
  resetDbLocation()
  assert('resetDbLocation returns to default', getDbInfo().isDefault === true)

  // ---- 4. Delete data keeps company + masters, wipes business data ----
  assert('before reset: products exist', productRepo.list().length === 2)
  assert('before reset: a sale exists', saleRepo.list().length === 1)
  resetData()
  check('after reset: products wiped', productRepo.list().length, 0)
  check('after reset: sales wiped', saleRepo.list().length, 0)
  check('after reset: vendors wiped', vendorRepo.list().length, 0)
  check('after reset: stock in hand zero', reportRepo.pnl('0001-01-01', '9999-12-31').stock_in_hand, 0)
  check('after reset: COMPANY KEPT', companyRepo.get().state_code, '27')
  assert('after reset: UNITS KEPT', unitRepo.list().length > 0)
  assert('after reset: CATEGORIES KEPT (incl ADDITIVE)', productCategoryRepo.list().some((c) => c.name === 'ADDITIVE'))

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`))
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(outFile, { force: true }) } catch {}
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
