import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import {
  companyRepo,
  unitRepo,
  productRepo,
  recipeRepo,
  vendorRepo,
  customerRepo,
  inventoryRepo,
  openingStockRepo,
  purchaseRepo,
  productionRepo,
  saleRepo,
  expenseRepo,
  reportRepo
} from './db'
import { exportProducts, importProducts, downloadProductTemplate, exportRows } from './excel'
import type { Result } from '@shared/types'

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown | Promise<unknown>

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (event, ...args): Promise<Result<unknown>> => {
    try {
      const data = await fn(event, ...args)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e).toUpperCase() }
    }
  })
}

function winOf(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpc(): void {
  // ---- Settings / Company ----
  handle('settings:get', () => companyRepo.get())
  handle('settings:save', (_e, payload) => companyRepo.save(payload))

  // ---- Units ----
  handle('units:list', () => unitRepo.list())
  handle('units:create', (_e, name: string) => unitRepo.create(name))

  // ---- Products ----
  handle('products:nextCode', (_e, type: string) => productRepo.nextCode(type))
  handle('products:list', (_e, type?: string) => productRepo.list(type))
  handle('products:get', (_e, id: number) => productRepo.get(id))
  handle('products:create', (_e, payload) => productRepo.create(payload))
  handle('products:update', (_e, id: number, payload) => productRepo.update(id, payload))
  handle('products:remove', (_e, id: number) => productRepo.remove(id))

  // ---- Recipes (BOM) ----
  handle('recipes:get', (_e, productId: number) => recipeRepo.get(productId))
  handle('recipes:save', (_e, productId: number, lines) => recipeRepo.save(productId, lines))

  // ---- Vendors ----
  handle('vendors:nextCode', () => vendorRepo.nextCode())
  handle('vendors:list', () => vendorRepo.list())
  handle('vendors:create', (_e, payload) => vendorRepo.create(payload))
  handle('vendors:update', (_e, id: number, payload) => vendorRepo.update(id, payload))
  handle('vendors:remove', (_e, id: number) => vendorRepo.remove(id))

  // ---- Customers ----
  handle('customers:nextCode', () => customerRepo.nextCode())
  handle('customers:list', () => customerRepo.list())
  handle('customers:create', (_e, payload) => customerRepo.create(payload))
  handle('customers:update', (_e, id: number, payload) => customerRepo.update(id, payload))
  handle('customers:remove', (_e, id: number) => customerRepo.remove(id))

  // ---- Inventory ----
  handle('inventory:list', (_e, type?: string) => inventoryRepo.list(type))

  // ---- Opening stock ----
  handle('openingStock:save', (_e, rows) => openingStockRepo.save(rows))

  // ---- Purchases ----
  handle('purchases:list', () => purchaseRepo.list())
  handle('purchases:get', (_e, id: number) => purchaseRepo.get(id))
  handle('purchases:nextVoucher', () => purchaseRepo.nextVoucher())
  handle('purchases:create', (_e, payload) => purchaseRepo.create(payload))
  handle('purchases:update', (_e, id: number, payload) => purchaseRepo.update(id, payload))
  handle('purchases:remove', (_e, id: number) => purchaseRepo.remove(id))

  // ---- Production ----
  handle('productions:list', () => productionRepo.list())
  handle('productions:get', (_e, id: number) => productionRepo.get(id))
  handle('productions:nextVoucher', () => productionRepo.nextVoucher())
  handle('productions:preview', (_e, productId: number, outputQty: number) =>
    productionRepo.preview(productId, outputQty)
  )
  handle('productions:create', (_e, payload) => productionRepo.create(payload))
  handle('productions:update', (_e, id: number, payload) => productionRepo.update(id, payload))
  handle('productions:remove', (_e, id: number) => productionRepo.remove(id))

  // ---- Sales ----
  handle('sales:list', () => saleRepo.list())
  handle('sales:get', (_e, id: number) => saleRepo.get(id))
  handle('sales:nextInvoice', () => saleRepo.nextInvoice())
  handle('sales:create', (_e, payload) => saleRepo.create(payload))
  handle('sales:update', (_e, id: number, payload) => saleRepo.update(id, payload))
  handle('sales:remove', (_e, id: number) => saleRepo.remove(id))

  // ---- Expenses ----
  handle('expenses:list', () => expenseRepo.list())
  handle('expenses:categories', () => expenseRepo.categories())
  handle('expenses:createCategory', (_e, name: string) => expenseRepo.createCategory(name))
  handle('expenses:nextVoucher', () => expenseRepo.nextVoucher())
  handle('expenses:create', (_e, payload) => expenseRepo.create(payload))
  handle('expenses:update', (_e, id: number, payload) => expenseRepo.update(id, payload))
  handle('expenses:remove', (_e, id: number) => expenseRepo.remove(id))

  // ---- Reports ----
  handle('reports:pnl', (_e, from?: string, to?: string) => reportRepo.pnl(from, to))
  handle('reports:monthly', () => reportRepo.monthly())
  handle('reports:dashboard', (_e, from?: string, to?: string) => reportRepo.dashboard(from, to))

  // ---- Excel ----
  handle('excel:exportProducts', (e) => exportProducts(winOf(e)))
  handle('excel:importProducts', (e) => importProducts(winOf(e)))
  handle('excel:productTemplate', (e) => downloadProductTemplate(winOf(e)))
  handle('excel:exportRows', (e, sheet: string, file: string, columns, rows) =>
    exportRows(winOf(e), sheet, file, columns, rows)
  )
}
