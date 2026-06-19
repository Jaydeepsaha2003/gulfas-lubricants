import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import {
  companyRepo,
  unitRepo,
  productRepo,
  recipeRepo,
  vendorRepo,
  customerRepo,
  inventoryRepo,
  openingStockRepo
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
  handle('products:list', (_e, type?: string) => productRepo.list(type))
  handle('products:get', (_e, id: number) => productRepo.get(id))
  handle('products:create', (_e, payload) => productRepo.create(payload))
  handle('products:update', (_e, id: number, payload) => productRepo.update(id, payload))
  handle('products:remove', (_e, id: number) => productRepo.remove(id))

  // ---- Recipes (BOM) ----
  handle('recipes:get', (_e, productId: number) => recipeRepo.get(productId))
  handle('recipes:save', (_e, productId: number, lines) => recipeRepo.save(productId, lines))

  // ---- Vendors ----
  handle('vendors:list', () => vendorRepo.list())
  handle('vendors:create', (_e, payload) => vendorRepo.create(payload))
  handle('vendors:update', (_e, id: number, payload) => vendorRepo.update(id, payload))
  handle('vendors:remove', (_e, id: number) => vendorRepo.remove(id))

  // ---- Customers ----
  handle('customers:list', () => customerRepo.list())
  handle('customers:create', (_e, payload) => customerRepo.create(payload))
  handle('customers:update', (_e, id: number, payload) => customerRepo.update(id, payload))
  handle('customers:remove', (_e, id: number) => customerRepo.remove(id))

  // ---- Inventory ----
  handle('inventory:list', (_e, type?: string) => inventoryRepo.list(type))

  // ---- Opening stock ----
  handle('openingStock:save', (_e, rows) => openingStockRepo.save(rows))

  // ---- Excel ----
  handle('excel:exportProducts', (e) => exportProducts(winOf(e)))
  handle('excel:importProducts', (e) => importProducts(winOf(e)))
  handle('excel:productTemplate', (e) => downloadProductTemplate(winOf(e)))
  handle('excel:exportRows', (e, sheet: string, file: string, columns, rows) =>
    exportRows(winOf(e), sheet, file, columns, rows)
  )
}
