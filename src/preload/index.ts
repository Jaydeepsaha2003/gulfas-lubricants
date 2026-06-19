import { contextBridge, ipcRenderer } from 'electron'
import type { Result } from '@shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!res || (res as any).ok === false) {
    throw new Error((res as any)?.error ?? 'UNKNOWN ERROR')
  }
  return (res as any).data as T
}

const api = {
  settings: {
    get: () => invoke<any>('settings:get'),
    save: (payload: any) => invoke<any>('settings:save', payload)
  },
  units: {
    list: () => invoke<any[]>('units:list'),
    create: (name: string) => invoke<any>('units:create', name)
  },
  products: {
    list: (type?: string) => invoke<any[]>('products:list', type),
    get: (id: number) => invoke<any>('products:get', id),
    create: (payload: any) => invoke<any>('products:create', payload),
    update: (id: number, payload: any) => invoke<any>('products:update', id, payload),
    remove: (id: number) => invoke<{ ok: boolean }>('products:remove', id)
  },
  recipes: {
    get: (productId: number) => invoke<any[]>('recipes:get', productId),
    save: (productId: number, lines: any[]) => invoke<any[]>('recipes:save', productId, lines)
  },
  vendors: {
    list: () => invoke<any[]>('vendors:list'),
    create: (payload: any) => invoke<any>('vendors:create', payload),
    update: (id: number, payload: any) => invoke<any>('vendors:update', id, payload),
    remove: (id: number) => invoke<{ ok: boolean }>('vendors:remove', id)
  },
  customers: {
    list: () => invoke<any[]>('customers:list'),
    create: (payload: any) => invoke<any>('customers:create', payload),
    update: (id: number, payload: any) => invoke<any>('customers:update', id, payload),
    remove: (id: number) => invoke<{ ok: boolean }>('customers:remove', id)
  },
  inventory: {
    list: (type?: string) => invoke<any[]>('inventory:list', type)
  },
  openingStock: {
    save: (rows: any[]) => invoke<{ inserted: number }>('openingStock:save', rows)
  },
  excel: {
    exportProducts: () => invoke<{ saved: boolean; path?: string }>('excel:exportProducts'),
    importProducts: () => invoke<any>('excel:importProducts'),
    productTemplate: () => invoke<{ saved: boolean }>('excel:productTemplate'),
    exportRows: (sheet: string, file: string, columns: any[], rows: any[]) =>
      invoke<{ saved: boolean }>('excel:exportRows', sheet, file, columns, rows)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
