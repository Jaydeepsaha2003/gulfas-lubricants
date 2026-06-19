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

export { all, one, run, insert, tx }
