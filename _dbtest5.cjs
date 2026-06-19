/* Integration test: GST-registration on parties + end-to-end sanity.
   Bundles src/main/db.ts with electron stubbed, runs against a throwaway DB. */
const path = require('path')
const os = require('os')
const fs = require('fs')
const esbuild = require('esbuild')

const tmpDir = path.join(os.tmpdir(), 'gulfas-test-' + process.pid)
fs.mkdirSync(tmpDir, { recursive: true })
// Bundle must live inside the project so its `require('sql.js')` resolves from node_modules.
const outFile = path.join(__dirname, '_db.bundle.cjs')

// Stub `electron` so app.getPath points at a throwaway dir.
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
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outFile,
    external: ['sql.js'],
    plugins: [electronStub],
    logLevel: 'error'
  })

  const db = require(outFile)
  await db.initDb()
  const { companyRepo, unitRepo, productRepo, vendorRepo, customerRepo, openingStockRepo, purchaseRepo, saleRepo, inventoryRepo } = db

  // ---- 1. GST registration on parties ----
  const party = (o) => ({ address: '', city: '', state: '', phone: '', email: '', is_active: 1, ...o })
  const vReg = vendorRepo.create(party({ code: 'VEN-0001', name: 'ACME OILS', gst_registered: 1, gstin: '27ABCDE1234F1Z5', state_code: '27' }))
  const vUnreg = vendorRepo.create(party({ code: 'VEN-0002', name: 'LOCAL SHOP', gst_registered: 0, gstin: 'SHOULDCLEAR', state_code: '27' }))
  check('registered vendor keeps gstin', vReg.gstin, '27ABCDE1234F1Z5')
  check('registered vendor flag', vReg.gst_registered, 1)
  check('unregistered vendor gstin cleared', vUnreg.gstin, '')
  check('unregistered vendor flag', vUnreg.gst_registered, 0)

  const flipped = vendorRepo.update(vUnreg.id, { ...vUnreg, gst_registered: 1, gstin: '27ZZZZZ9999Z9Z9' })
  check('flip to registered stores gstin', flipped.gstin, '27ZZZZZ9999Z9Z9')
  check('flip to registered flag', flipped.gst_registered, 1)

  const cUnreg = customerRepo.create(party({ code: 'CUS-0001', name: 'WALK IN CUSTOMER', gst_registered: 0, gstin: 'X', state_code: '27' }))
  check('unregistered customer gstin cleared', cUnreg.gstin, '')
  check('unregistered customer flag', cUnreg.gst_registered, 0)

  // ---- 2. Company state for intra-state GST ----
  const co = companyRepo.get()
  companyRepo.save({ ...co, state_code: '27', gst_pricing_mode: 'EXCLUSIVE' })

  const pcs = unitRepo.list().find((u) => u.name === 'PCS').id
  const fg = productRepo.create({
    code: 'FG-0001', name: 'ENGINE OIL 1L', type: 'FINISHED', unit_id: pcs,
    hsn_code: '2710', gst_rate: 18, purchase_price: 0, sale_price: 250,
    reorder_level: 0, recipe_output_qty: 1, units_per_box: 12
  })
  openingStockRepo.save([{ product_id: fg.id, quantity: 100, unit_cost: 150, as_on_date: '2026-01-01' }])

  // ---- 3. Sale to UNREGISTERED customer still applies GST (B2C, intra-state) ----
  const sale = saleRepo.create({
    invoice_no: 'INV-0001', sale_date: '2026-02-01', customer_id: cUnreg.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: fg.id, quantity: 10, rate: 250, gst_rate: 18, uom: 'EACH' }]
  })
  check('B2C taxable', sale.taxable_total, 2500)
  check('B2C cgst', sale.cgst, 225)
  check('B2C sgst', sale.sgst, 225)
  check('B2C igst (intra=0)', sale.igst, 0)
  check('B2C grand total', sale.grand_total, 2950)
  check('B2C cogs (FIFO 10x150)', sale.cogs, 1500)

  const qtyAfterSale = inventoryRepo.list('FINISHED').find((r) => r.product_id === fg.id).qty
  check('stock after EACH sale', qtyAfterSale, 90)

  // ---- 4. Delete sale restores stock ----
  saleRepo.remove(sale.id)
  const qtyAfterDelete = inventoryRepo.list('FINISHED').find((r) => r.product_id === fg.id).qty
  check('stock restored after sale delete', qtyAfterDelete, 100)

  // ---- 5. BOX sale deducts base units ----
  const boxSale = saleRepo.create({
    invoice_no: 'INV-0002', sale_date: '2026-02-02', customer_id: cUnreg.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: fg.id, quantity: 1, rate: 3000, gst_rate: 18, uom: 'BOX' }]
  })
  check('BOX cogs (12x150)', boxSale.cogs, 1800)
  const qtyAfterBox = inventoryRepo.list('FINISHED').find((r) => r.product_id === fg.id).qty
  check('stock after BOX sale (100-12)', qtyAfterBox, 88)

  // ---- 6. Purchase JOIN vendor + get/update/delete still work post schema change ----
  const rm = productRepo.create({
    code: 'RM-0001', name: 'BASE OIL', type: 'RAW', unit_id: pcs,
    hsn_code: '2710', gst_rate: 18, purchase_price: 50, sale_price: 0,
    reorder_level: 0, recipe_output_qty: 1, units_per_box: 1
  })
  const pur = purchaseRepo.create({
    voucher_no: 'PUR-0001', purchase_date: '2026-01-05', vendor_id: vReg.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: rm.id, quantity: 20, rate: 50, gst_rate: 18 }]
  })
  check('purchase taxable', pur.taxable_total, 1000)
  check('purchase grand total', pur.grand_total, 1180)
  const pget = purchaseRepo.get(pur.id)
  assert('purchase.get returns items', pget.items.length === 1 && approx(pget.items[0].quantity, 20))
  assert('purchase.list has vendor_name', purchaseRepo.list()[0].vendor_name === 'ACME OILS')
  purchaseRepo.update(pur.id, {
    voucher_no: 'PUR-0001', purchase_date: '2026-01-05', vendor_id: vReg.id, gst_pricing_mode: 'EXCLUSIVE',
    items: [{ product_id: rm.id, quantity: 30, rate: 50, gst_rate: 18 }]
  })
  check('purchase taxable after edit', purchaseRepo.get(pur.id).taxable_total, 1500)
  purchaseRepo.remove(pur.id)
  assert('purchase deleted', purchaseRepo.list().length === 0)

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`))
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(outFile, { force: true }) } catch {}
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
