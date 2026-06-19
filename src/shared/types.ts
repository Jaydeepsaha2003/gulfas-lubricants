// ============================================================================
// Shared domain types — used by both the main process (DB) and the renderer.
// ============================================================================

export type ProductType = 'RAW' | 'FINISHED'
export type GstPricingMode = 'INCLUSIVE' | 'EXCLUSIVE'
export type DocNumberingMode = 'AUTOMATIC' | 'MANUAL'
export type StockSource = 'OPENING' | 'PURCHASE' | 'PRODUCTION' | 'ADJUSTMENT'
export type StockMoveType = 'IN' | 'OUT'

export interface Company {
  id: number
  name: string
  gstin: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  state_code: string
  pincode: string
  phone: string
  email: string
  logo_data: string // base64 data-url, may be empty
  gst_pricing_mode: GstPricingMode
  doc_numbering: DocNumberingMode
  currency_symbol: string
  invoice_prefix: string
  financial_year_start: string // e.g. "04-01" (MM-DD)
  updated_at: string
}

export interface Unit {
  id: number
  name: string
  created_at: string
}

export interface Product {
  id: number
  code: string
  name: string
  type: ProductType
  unit_id: number
  unit_name?: string
  hsn_code: string
  gst_rate: number
  purchase_price: number
  sale_price: number
  reorder_level: number
  recipe_output_qty: number // for FINISHED: std units produced per recipe run
  is_active: number // 0/1
  created_at: string
  updated_at: string
}

export interface RecipeLine {
  id?: number
  product_id: number // finished product
  component_product_id: number // raw material
  component_name?: string
  component_unit?: string
  quantity: number
}

export interface Party {
  id: number
  code: string
  name: string
  gstin: string
  address: string
  city: string
  state: string
  state_code: string
  phone: string
  email: string
  is_active: number
  created_at: string
}

export interface StockLot {
  id: number
  product_id: number
  source_type: StockSource
  source_id: number | null
  lot_date: string
  qty_in: number
  qty_remaining: number
  unit_cost: number
  created_at: string
}

export interface InventoryRow {
  product_id: number
  code: string
  name: string
  type: ProductType
  unit_name: string
  qty: number
  avg_cost: number
  stock_value: number
  reorder_level: number
}

export interface OpeningStockInput {
  product_id: number
  quantity: number
  unit_cost: number
  as_on_date: string
}

// ---- Generic CRUD payloads -------------------------------------------------

export type NewProduct = Omit<
  Product,
  'id' | 'created_at' | 'updated_at' | 'unit_name'
>
export type NewParty = Omit<Party, 'id' | 'created_at'>

// ---- Excel ----------------------------------------------------------------

export type ExcelEntity = 'products' | 'vendors' | 'customers'

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

// ---- IPC result envelope ---------------------------------------------------

export interface Ok<T> {
  ok: true
  data: T
}
export interface Err {
  ok: false
  error: string
}
export type Result<T> = Ok<T> | Err
