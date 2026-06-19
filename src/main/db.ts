import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import initSqlJs, { Database, SqlValue } from 'sql.js'

let db: Database
let dbPath: string

const now = (): string => new Date().toISOString()

// ---------------------------------------------------------------------------
// Connection + persistence
// ---------------------------------------------------------------------------

export async function initDb(): Promise<void> {
  const userDir = app.getPath('userData')
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
  dbPath = join(userDir, 'gulfas.sqlite')

  // sql.js ships the wasm next to its JS entry. Read the bytes ourselves and
  // hand them to the loader via `wasmBinary` — this works in dev AND inside the
  // packaged app.asar archive (Electron's fs can read from asar), so we never
  // depend on a fetch/locateFile path that breaks once packaged.
  const sqlJsDir = dirname(require.resolve('sql.js'))
  const wasmFile = readFileSync(join(sqlJsDir, 'sql-wasm.wasm'))
  const wasmBinary = wasmFile.buffer.slice(
    wasmFile.byteOffset,
    wasmFile.byteOffset + wasmFile.byteLength
  )
  const SQL = await initSqlJs({ wasmBinary, locateFile: (f) => join(sqlJsDir, f) })

  db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()
  db.run('PRAGMA foreign_keys = ON;')
  createSchema()
  seed()
  save()
}

export function save(): void {
  if (!db) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

// ---------------------------------------------------------------------------
// Tiny query helpers (positional ? params)
// ---------------------------------------------------------------------------

type Params = SqlValue[]

function all<T = any>(sql: string, params: Params = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as T)
  stmt.free()
  return rows
}

function one<T = any>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0]
}

function run(sql: string, params: Params = []): void {
  db.run(sql, params)
}

function insert(sql: string, params: Params = []): number {
  db.run(sql, params)
  const r = one<{ id: number }>('SELECT last_insert_rowid() AS id')
  return r ? r.id : 0
}

/** Run a function inside a transaction; rolls back on error. */
function tx<T>(fn: () => T): T {
  db.run('BEGIN')
  try {
    const result = fn()
    db.run('COMMIT')
    save()
    return result
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function createSchema(): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    state_code TEXT NOT NULL DEFAULT '',
    pincode TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    logo_data TEXT NOT NULL DEFAULT '',
    gst_pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    financial_year_start TEXT NOT NULL DEFAULT '04-01',
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('RAW','FINISHED')),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    hsn_code TEXT NOT NULL DEFAULT '',
    gst_rate REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    reorder_level REAL NOT NULL DEFAULT 0,
    recipe_output_qty REAL NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    gstin TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    state_code TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    gstin TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    state_code TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    source_type TEXT NOT NULL,
    source_id INTEGER,
    lot_date TEXT NOT NULL,
    qty_in REAL NOT NULL,
    qty_remaining REAL NOT NULL,
    unit_cost REAL NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_lots_product ON stock_lots(product_id, qty_remaining);

  CREATE TABLE IF NOT EXISTS stock_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    move_date TEXT NOT NULL,
    move_type TEXT NOT NULL CHECK (move_type IN ('IN','OUT')),
    qty REAL NOT NULL,
    unit_cost REAL NOT NULL,
    lot_id INTEGER,
    ref_type TEXT NOT NULL DEFAULT '',
    ref_id INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_moves_product ON stock_moves(product_id, move_date);

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id),
    gst_pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    taxable_total REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    igst REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    rate REAL NOT NULL,
    gst_rate REAL NOT NULL DEFAULT 0,
    taxable_value REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    igst REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS productions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    production_date TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    output_qty REAL NOT NULL,
    total_input_cost REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS production_inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    component_product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    gst_pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    place_of_supply TEXT NOT NULL DEFAULT '',
    taxable_total REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    igst REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    cogs REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    rate REAL NOT NULL,
    gst_rate REAL NOT NULL DEFAULT 0,
    taxable_value REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    igst REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    cogs REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id),
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  `)
}

function seed(): void {
  const hasCompany = one<{ c: number }>('SELECT COUNT(*) AS c FROM company')
  if (!hasCompany || hasCompany.c === 0) {
    run('INSERT INTO company (id, updated_at) VALUES (1, ?)', [now()])
  }
  const unitCount = one<{ c: number }>('SELECT COUNT(*) AS c FROM units')
  if (!unitCount || unitCount.c === 0) {
    for (const u of ['PCS', 'LITRE', 'ML', 'KG', 'GRAM', 'BOX', 'SET']) {
      run('INSERT INTO units (name, created_at) VALUES (?, ?)', [u, now()])
    }
  }
  const catCount = one<{ c: number }>('SELECT COUNT(*) AS c FROM expense_categories')
  if (!catCount || catCount.c === 0) {
    for (const c of ['RENT', 'SALARY', 'ELECTRICITY', 'TRANSPORT', 'PACKAGING', 'MARKETING', 'MISCELLANEOUS']) {
      run('INSERT INTO expense_categories (name, created_at) VALUES (?, ?)', [c, now()])
    }
  }
}

// ---------------------------------------------------------------------------
// FIFO stock helpers (used by purchase / production / sales)
// ---------------------------------------------------------------------------

export function addLot(
  productId: number,
  qty: number,
  unitCost: number,
  sourceType: string,
  sourceId: number | null,
  date: string
): number {
  const lotId = insert(
    `INSERT INTO stock_lots (product_id, source_type, source_id, lot_date, qty_in, qty_remaining, unit_cost, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, sourceType, sourceId, date, qty, qty, unitCost, now()]
  )
  run(
    `INSERT INTO stock_moves (product_id, move_date, move_type, qty, unit_cost, lot_id, ref_type, ref_id, notes, created_at)
     VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, '', ?)`,
    [productId, date, qty, unitCost, lotId, sourceType, sourceId, now()]
  )
  return lotId
}

export interface ConsumeResult {
  cost: number
  shortBy: number
}

/** Consume qty from oldest lots first (FIFO). Returns total cost + any shortage. */
export function consumeFIFO(
  productId: number,
  qty: number,
  refType: string,
  refId: number | null,
  date: string
): ConsumeResult {
  let remaining = qty
  let cost = 0
  const lots = all<{ id: number; qty_remaining: number; unit_cost: number }>(
    `SELECT id, qty_remaining, unit_cost FROM stock_lots
     WHERE product_id = ? AND qty_remaining > 0
     ORDER BY lot_date ASC, id ASC`,
    [productId]
  )
  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(remaining, lot.qty_remaining)
    cost += take * lot.unit_cost
    run('UPDATE stock_lots SET qty_remaining = qty_remaining - ? WHERE id = ?', [take, lot.id])
    run(
      `INSERT INTO stock_moves (product_id, move_date, move_type, qty, unit_cost, lot_id, ref_type, ref_id, notes, created_at)
       VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, '', ?)`,
      [productId, date, take, lot.unit_cost, lot.id, refType, refId, now()]
    )
    remaining -= take
  }
  return { cost, shortBy: remaining > 0 ? remaining : 0 }
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export const companyRepo = {
  get() {
    return one('SELECT * FROM company WHERE id = 1')
  },
  save(c: Record<string, SqlValue>) {
    run(
      `UPDATE company SET name=?, gstin=?, address_line1=?, address_line2=?, city=?, state=?,
        state_code=?, pincode=?, phone=?, email=?, logo_data=?, gst_pricing_mode=?, currency_symbol=?,
        invoice_prefix=?, financial_year_start=?, updated_at=? WHERE id = 1`,
      [
        c.name, c.gstin, c.address_line1, c.address_line2, c.city, c.state, c.state_code,
        c.pincode, c.phone, c.email, c.logo_data, c.gst_pricing_mode, c.currency_symbol,
        c.invoice_prefix, c.financial_year_start, now()
      ]
    )
    save()
    return this.get()
  }
}

export const unitRepo = {
  list() {
    return all('SELECT * FROM units ORDER BY name')
  },
  create(name: string) {
    const id = insert('INSERT INTO units (name, created_at) VALUES (?, ?)', [name, now()])
    save()
    return one('SELECT * FROM units WHERE id = ?', [id])
  }
}

export const productRepo = {
  list(type?: string) {
    const sql = `SELECT p.*, u.name AS unit_name FROM products p
                 JOIN units u ON u.id = p.unit_id
                 ${type ? 'WHERE p.type = ?' : ''}
                 ORDER BY p.name`
    return type ? all(sql, [type]) : all(sql)
  },
  get(id: number) {
    return one(
      `SELECT p.*, u.name AS unit_name FROM products p JOIN units u ON u.id = p.unit_id WHERE p.id = ?`,
      [id]
    )
  },
  create(p: Record<string, SqlValue>) {
    const id = insert(
      `INSERT INTO products (code, name, type, unit_id, hsn_code, gst_rate, purchase_price, sale_price,
        reorder_level, recipe_output_qty, is_active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.code, p.name, p.type, p.unit_id, p.hsn_code, p.gst_rate, p.purchase_price, p.sale_price,
        p.reorder_level, p.recipe_output_qty, p.is_active ?? 1, now(), now()
      ]
    )
    save()
    return this.get(id)
  },
  update(id: number, p: Record<string, SqlValue>) {
    run(
      `UPDATE products SET code=?, name=?, type=?, unit_id=?, hsn_code=?, gst_rate=?, purchase_price=?,
        sale_price=?, reorder_level=?, recipe_output_qty=?, is_active=?, updated_at=? WHERE id=?`,
      [
        p.code, p.name, p.type, p.unit_id, p.hsn_code, p.gst_rate, p.purchase_price, p.sale_price,
        p.reorder_level, p.recipe_output_qty, p.is_active ?? 1, now(), id
      ]
    )
    save()
    return this.get(id)
  },
  remove(id: number) {
    const used = one<{ c: number }>(
      `SELECT (SELECT COUNT(*) FROM purchase_items WHERE product_id=?)
            + (SELECT COUNT(*) FROM sale_items WHERE product_id=?)
            + (SELECT COUNT(*) FROM stock_lots WHERE product_id=?) AS c`,
      [id, id, id]
    )
    if (used && used.c > 0) {
      run('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [now(), id])
    } else {
      run('DELETE FROM product_recipes WHERE product_id = ?', [id])
      run('DELETE FROM products WHERE id = ?', [id])
    }
    save()
    return { ok: true }
  }
}

export const recipeRepo = {
  get(productId: number) {
    return all(
      `SELECT r.*, c.name AS component_name, u.name AS component_unit
       FROM product_recipes r
       JOIN products c ON c.id = r.component_product_id
       JOIN units u ON u.id = c.unit_id
       WHERE r.product_id = ? ORDER BY c.name`,
      [productId]
    )
  },
  save(productId: number, lines: Array<{ component_product_id: number; quantity: number }>) {
    return tx(() => {
      run('DELETE FROM product_recipes WHERE product_id = ?', [productId])
      for (const l of lines) {
        run(
          'INSERT INTO product_recipes (product_id, component_product_id, quantity) VALUES (?,?,?)',
          [productId, l.component_product_id, l.quantity]
        )
      }
      return recipeRepo.get(productId)
    })
  }
}

function partyRepo(table: 'vendors' | 'customers') {
  return {
    list() {
      return all(`SELECT * FROM ${table} ORDER BY name`)
    },
    create(p: Record<string, SqlValue>) {
      const id = insert(
        `INSERT INTO ${table} (code, name, gstin, address, city, state, state_code, phone, email, is_active, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [p.code, p.name, p.gstin, p.address, p.city, p.state, p.state_code, p.phone, p.email, p.is_active ?? 1, now()]
      )
      save()
      return one(`SELECT * FROM ${table} WHERE id = ?`, [id])
    },
    update(id: number, p: Record<string, SqlValue>) {
      run(
        `UPDATE ${table} SET code=?, name=?, gstin=?, address=?, city=?, state=?, state_code=?, phone=?, email=?, is_active=? WHERE id=?`,
        [p.code, p.name, p.gstin, p.address, p.city, p.state, p.state_code, p.phone, p.email, p.is_active ?? 1, id]
      )
      save()
      return one(`SELECT * FROM ${table} WHERE id = ?`, [id])
    },
    remove(id: number) {
      run(`UPDATE ${table} SET is_active = 0 WHERE id = ?`, [id])
      save()
      return { ok: true }
    }
  }
}

export const vendorRepo = partyRepo('vendors')
export const customerRepo = partyRepo('customers')

export const inventoryRepo = {
  list(type?: string) {
    const sql = `
      SELECT p.id AS product_id, p.code, p.name, p.type, u.name AS unit_name, p.reorder_level,
        COALESCE(SUM(l.qty_remaining), 0) AS qty,
        CASE WHEN COALESCE(SUM(l.qty_remaining),0) > 0
             THEN SUM(l.qty_remaining * l.unit_cost) / SUM(l.qty_remaining) ELSE 0 END AS avg_cost,
        COALESCE(SUM(l.qty_remaining * l.unit_cost), 0) AS stock_value
      FROM products p
      JOIN units u ON u.id = p.unit_id
      LEFT JOIN stock_lots l ON l.product_id = p.id AND l.qty_remaining > 0
      ${type ? 'WHERE p.type = ?' : ''}
      GROUP BY p.id
      ORDER BY p.name`
    return type ? all(sql, [type]) : all(sql)
  }
}

export const openingStockRepo = {
  save(rows: Array<{ product_id: number; quantity: number; unit_cost: number; as_on_date: string }>) {
    return tx(() => {
      let count = 0
      for (const r of rows) {
        if (!r.product_id || r.quantity <= 0) continue
        addLot(r.product_id, r.quantity, r.unit_cost, 'OPENING', null, r.as_on_date)
        count++
      }
      return { inserted: count }
    })
  }
}

// ---------------------------------------------------------------------------
// Transactions: purchase / production / sales / expenses / reports
// ---------------------------------------------------------------------------

function seq(table: string, prefix: string): string {
  const c = one<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)
  return `${prefix}-${String((c?.c ?? 0) + 1).padStart(4, '0')}`
}

interface LineCalc {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  lineTotal: number
  unitCost: number
}

/** GST-aware line math. interState => IGST, else CGST+SGST. */
function computeLine(
  qty: number,
  rate: number,
  gstRate: number,
  mode: string,
  interState: boolean
): LineCalc {
  const gross = qty * rate
  let taxable: number
  let tax: number
  if (mode === 'INCLUSIVE') {
    taxable = gross / (1 + gstRate / 100)
    tax = gross - taxable
  } else {
    taxable = gross
    tax = (taxable * gstRate) / 100
  }
  return {
    taxable,
    cgst: interState ? 0 : tax / 2,
    sgst: interState ? 0 : tax / 2,
    igst: interState ? tax : 0,
    lineTotal: taxable + tax,
    unitCost: qty > 0 ? taxable / qty : 0
  }
}

function companyStateCode(): string {
  return one<{ state_code: string }>('SELECT state_code FROM company WHERE id = 1')?.state_code ?? ''
}

function available(productId: number): number {
  return (
    one<{ q: number }>(
      'SELECT COALESCE(SUM(qty_remaining),0) AS q FROM stock_lots WHERE product_id = ?',
      [productId]
    )?.q ?? 0
  )
}

function nameOf(productId: number): string {
  return one<{ name: string }>('SELECT name FROM products WHERE id = ?', [productId])?.name ?? '#' + productId
}

export const purchaseRepo = {
  list() {
    return all(
      `SELECT p.*, v.name AS vendor_name FROM purchases p
       JOIN vendors v ON v.id = p.vendor_id
       ORDER BY p.purchase_date DESC, p.id DESC`
    )
  },
  nextVoucher() {
    return seq('purchases', 'PUR')
  },
  create(h: any) {
    return tx(() => {
      const vendor = one<{ state_code: string }>('SELECT state_code FROM vendors WHERE id = ?', [h.vendor_id])
      const inter = !!vendor?.state_code && vendor.state_code !== companyStateCode()
      const mode = h.gst_pricing_mode || 'EXCLUSIVE'
      const pid = insert(
        `INSERT INTO purchases (voucher_no, purchase_date, vendor_id, gst_pricing_mode, taxable_total, cgst, sgst, igst, grand_total, notes, created_at)
         VALUES (?,?,?,?,0,0,0,0,0,?,?)`,
        [h.voucher_no, h.purchase_date, h.vendor_id, mode, h.notes || '', now()]
      )
      let taxable = 0, cgst = 0, sgst = 0, igst = 0, total = 0
      for (const it of h.items || []) {
        const qty = Number(it.quantity) || 0
        const rate = Number(it.rate) || 0
        const gr = Number(it.gst_rate) || 0
        if (qty <= 0 || !it.product_id) continue
        const L = computeLine(qty, rate, gr, mode, inter)
        insert(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, gst_rate, taxable_value, cgst, sgst, igst, line_total)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [pid, it.product_id, qty, rate, gr, L.taxable, L.cgst, L.sgst, L.igst, L.lineTotal]
        )
        addLot(it.product_id, qty, L.unitCost, 'PURCHASE', pid, h.purchase_date)
        taxable += L.taxable; cgst += L.cgst; sgst += L.sgst; igst += L.igst; total += L.lineTotal
      }
      run('UPDATE purchases SET taxable_total=?, cgst=?, sgst=?, igst=?, grand_total=? WHERE id=?', [taxable, cgst, sgst, igst, total, pid])
      return one('SELECT * FROM purchases WHERE id = ?', [pid])
    })
  }
}

export const productionRepo = {
  list() {
    return all(
      `SELECT pr.*, p.name AS product_name FROM productions pr
       JOIN products p ON p.id = pr.product_id
       ORDER BY pr.production_date DESC, pr.id DESC`
    )
  },
  nextVoucher() {
    return seq('productions', 'PRD')
  },
  /** Required inputs + availability for a planned batch (for the UI). */
  preview(productId: number, outputQty: number) {
    const prod = one<{ recipe_output_qty: number }>('SELECT recipe_output_qty FROM products WHERE id = ?', [productId])
    const scale = (Number(outputQty) || 0) / (prod?.recipe_output_qty || 1)
    const recipe = recipeRepo.get(productId) as any[]
    return recipe.map((r) => {
      const required = r.quantity * scale
      const have = available(r.component_product_id)
      return {
        component_product_id: r.component_product_id,
        component_name: r.component_name,
        component_unit: r.component_unit,
        per_batch: r.quantity,
        required,
        available: have,
        short: required > have + 1e-9
      }
    })
  },
  create(h: any) {
    return tx(() => {
      const prod = one<{ recipe_output_qty: number }>('SELECT recipe_output_qty FROM products WHERE id = ?', [h.product_id])
      const outputQty = Number(h.output_qty) || 0
      if (outputQty <= 0) throw new Error('OUTPUT QUANTITY MUST BE GREATER THAN 0')
      const scale = outputQty / (prod?.recipe_output_qty || 1)
      const inputs: Array<{ component_product_id: number; quantity: number }> =
        h.inputs && h.inputs.length
          ? h.inputs.map((i: any) => ({ component_product_id: i.component_product_id, quantity: Number(i.quantity) || 0 }))
          : (recipeRepo.get(h.product_id) as any[]).map((r) => ({
              component_product_id: r.component_product_id,
              quantity: r.quantity * scale
            }))
      if (!inputs.length) throw new Error('NO RECIPE DEFINED FOR THIS PRODUCT — ADD A RECIPE FIRST')
      for (const inp of inputs) {
        if (inp.quantity <= 0) continue
        if (available(inp.component_product_id) < inp.quantity - 1e-9) {
          throw new Error(
            `INSUFFICIENT STOCK OF ${nameOf(inp.component_product_id)} (NEED ${inp.quantity}, HAVE ${available(inp.component_product_id)})`
          )
        }
      }
      const prodId = insert(
        `INSERT INTO productions (voucher_no, production_date, product_id, output_qty, total_input_cost, unit_cost, notes, created_at)
         VALUES (?,?,?,?,0,0,?,?)`,
        [h.voucher_no, h.production_date, h.product_id, outputQty, h.notes || '', now()]
      )
      let totalCost = 0
      for (const inp of inputs) {
        if (inp.quantity <= 0) continue
        const r = consumeFIFO(inp.component_product_id, inp.quantity, 'PRODUCTION', prodId, h.production_date)
        totalCost += r.cost
        insert('INSERT INTO production_inputs (production_id, component_product_id, quantity, cost) VALUES (?,?,?,?)', [
          prodId, inp.component_product_id, inp.quantity, r.cost
        ])
      }
      const unitCost = outputQty > 0 ? totalCost / outputQty : 0
      run('UPDATE productions SET total_input_cost=?, unit_cost=? WHERE id=?', [totalCost, unitCost, prodId])
      addLot(h.product_id, outputQty, unitCost, 'PRODUCTION', prodId, h.production_date)
      return one('SELECT * FROM productions WHERE id = ?', [prodId])
    })
  }
}

export const saleRepo = {
  list() {
    return all(
      `SELECT s.*, c.name AS customer_name FROM sales s
       JOIN customers c ON c.id = s.customer_id
       ORDER BY s.sale_date DESC, s.id DESC`
    )
  },
  nextInvoice() {
    const prefix = one<{ invoice_prefix: string }>('SELECT invoice_prefix FROM company WHERE id = 1')?.invoice_prefix || 'INV'
    const c = one<{ c: number }>('SELECT COUNT(*) AS c FROM sales')
    return `${prefix}-${String((c?.c ?? 0) + 1).padStart(4, '0')}`
  },
  create(h: any) {
    return tx(() => {
      const cust = one<{ state_code: string }>('SELECT state_code FROM customers WHERE id = ?', [h.customer_id])
      const inter = !!cust?.state_code && cust.state_code !== companyStateCode()
      const mode = h.gst_pricing_mode || 'EXCLUSIVE'
      for (const it of h.items || []) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0 || !it.product_id) continue
        if (available(it.product_id) < qty - 1e-9) {
          throw new Error(`INSUFFICIENT STOCK TO SELL ${nameOf(it.product_id)} (NEED ${qty}, HAVE ${available(it.product_id)})`)
        }
      }
      const sid = insert(
        `INSERT INTO sales (invoice_no, sale_date, customer_id, gst_pricing_mode, place_of_supply, taxable_total, cgst, sgst, igst, grand_total, cogs, notes, created_at)
         VALUES (?,?,?,?,?,0,0,0,0,0,0,?,?)`,
        [h.invoice_no, h.sale_date, h.customer_id, mode, cust?.state_code || '', h.notes || '', now()]
      )
      let taxable = 0, cgst = 0, sgst = 0, igst = 0, total = 0, cogsTotal = 0
      for (const it of h.items || []) {
        const qty = Number(it.quantity) || 0
        const rate = Number(it.rate) || 0
        const gr = Number(it.gst_rate) || 0
        if (qty <= 0 || !it.product_id) continue
        const L = computeLine(qty, rate, gr, mode, inter)
        const cogs = consumeFIFO(it.product_id, qty, 'SALE', sid, h.sale_date)
        insert(
          `INSERT INTO sale_items (sale_id, product_id, quantity, rate, gst_rate, taxable_value, cgst, sgst, igst, line_total, cogs)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [sid, it.product_id, qty, rate, gr, L.taxable, L.cgst, L.sgst, L.igst, L.lineTotal, cogs.cost]
        )
        taxable += L.taxable; cgst += L.cgst; sgst += L.sgst; igst += L.igst; total += L.lineTotal; cogsTotal += cogs.cost
      }
      run('UPDATE sales SET taxable_total=?, cgst=?, sgst=?, igst=?, grand_total=?, cogs=? WHERE id=?', [taxable, cgst, sgst, igst, total, cogsTotal, sid])
      return one('SELECT * FROM sales WHERE id = ?', [sid])
    })
  }
}

export const expenseRepo = {
  categories() {
    return all('SELECT * FROM expense_categories ORDER BY name')
  },
  createCategory(name: string) {
    const id = insert('INSERT INTO expense_categories (name, created_at) VALUES (?,?)', [name, now()])
    save()
    return one('SELECT * FROM expense_categories WHERE id = ?', [id])
  },
  list() {
    return all(
      `SELECT e.*, c.name AS category_name FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       ORDER BY e.expense_date DESC, e.id DESC`
    )
  },
  nextVoucher() {
    return seq('expenses', 'EXP')
  },
  create(h: any) {
    const id = insert(
      `INSERT INTO expenses (voucher_no, expense_date, category_id, description, amount, notes, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [h.voucher_no, h.expense_date, h.category_id || null, h.description || '', Number(h.amount) || 0, h.notes || '', now()]
    )
    save()
    return one('SELECT * FROM expenses WHERE id = ?', [id])
  },
  remove(id: number) {
    run('DELETE FROM expenses WHERE id = ?', [id])
    save()
    return { ok: true }
  }
}

export const reportRepo = {
  pnl(from?: string, to?: string) {
    const f = from || '0000-01-01'
    const t = to || '9999-12-31'
    const sales = one<{ rev: number; cogs: number; cnt: number }>(
      'SELECT COALESCE(SUM(taxable_total),0) AS rev, COALESCE(SUM(cogs),0) AS cogs, COUNT(*) AS cnt FROM sales WHERE sale_date BETWEEN ? AND ?',
      [f, t]
    )!
    const exp = one<{ amt: number }>('SELECT COALESCE(SUM(amount),0) AS amt FROM expenses WHERE expense_date BETWEEN ? AND ?', [f, t])!
    const purchases = one<{ amt: number; cnt: number }>(
      'SELECT COALESCE(SUM(taxable_total),0) AS amt, COUNT(*) AS cnt FROM purchases WHERE purchase_date BETWEEN ? AND ?',
      [f, t]
    )!
    const grossProfit = sales.rev - sales.cogs
    const byCategory = all(
      `SELECT COALESCE(c.name,'UNCATEGORISED') AS name, SUM(e.amount) AS amount
       FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.expense_date BETWEEN ? AND ? GROUP BY c.id ORDER BY amount DESC`,
      [f, t]
    )
    return {
      revenue: sales.rev,
      cogs: sales.cogs,
      gross_profit: grossProfit,
      expenses: exp.amt,
      net_profit: grossProfit - exp.amt,
      sales_count: sales.cnt,
      purchases_total: purchases.amt,
      purchases_count: purchases.cnt,
      expense_by_category: byCategory
    }
  },
  monthly() {
    return all(
      `SELECT substr(sale_date,1,7) AS ym, SUM(taxable_total) AS revenue, SUM(cogs) AS cogs
       FROM sales GROUP BY ym ORDER BY ym ASC`
    )
  }
}

export { all, one, run, insert, tx }
