import { dialog, BrowserWindow } from 'electron'
import ExcelJS from 'exceljs'
import { all, run, save, productRepo, unitRepo } from './db'
import type { ImportResult } from '@shared/types'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1D4ED8' }
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  ws.getRow(1).height = 20
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

const UP = (v: unknown): string => String(v ?? '').trim().toUpperCase()
const NUM = (v: unknown): number => {
  const n = Number(String(v ?? '').toString().replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

// ---- Generic export of an array of flat objects ----------------------------

export async function exportRows(
  win: BrowserWindow | null,
  sheetName: string,
  defaultFile: string,
  columns: Array<{ header: string; key: string; width?: number }>,
  rows: Array<Record<string, unknown>>
): Promise<{ saved: boolean; path?: string }> {
  const res = await dialog.showSaveDialog(win ?? undefined!, {
    title: `EXPORT ${sheetName.toUpperCase()}`,
    defaultPath: defaultFile,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { saved: false }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }))
  rows.forEach((r) => ws.addRow(r))
  styleHeader(ws)
  await wb.xlsx.writeFile(res.filePath)
  return { saved: true, path: res.filePath }
}

// ---- Products --------------------------------------------------------------

const PRODUCT_COLUMNS = [
  { header: 'CODE', key: 'code', width: 16 },
  { header: 'NAME', key: 'name', width: 32 },
  { header: 'TYPE (RAW/FINISHED)', key: 'type', width: 20 },
  { header: 'UNIT', key: 'unit_name', width: 12 },
  { header: 'HSN_CODE', key: 'hsn_code', width: 14 },
  { header: 'GST_RATE', key: 'gst_rate', width: 10 },
  { header: 'PURCHASE_PRICE', key: 'purchase_price', width: 16 },
  { header: 'SALE_PRICE', key: 'sale_price', width: 14 },
  { header: 'REORDER_LEVEL', key: 'reorder_level', width: 14 },
  { header: 'RECIPE_OUTPUT_QTY', key: 'recipe_output_qty', width: 18 },
  { header: 'UNITS_PER_BOX', key: 'units_per_box', width: 14 }
]

export async function exportProducts(win: BrowserWindow | null): Promise<{ saved: boolean; path?: string }> {
  const rows = productRepo.list() as any[]
  return exportRows(win, 'Products', 'PRODUCTS.xlsx', PRODUCT_COLUMNS, rows)
}

export async function downloadProductTemplate(win: BrowserWindow | null): Promise<{ saved: boolean }> {
  const sample = [
    {
      code: 'RM-BOTTLE-1L',
      name: 'PET BOTTLE 1 LITRE',
      type: 'RAW',
      unit_name: 'PCS',
      hsn_code: '3923',
      gst_rate: 18,
      purchase_price: 8,
      sale_price: 0,
      reorder_level: 500,
      recipe_output_qty: 1,
      units_per_box: 1
    },
    {
      code: 'FG-ENGINE-OIL-1L',
      name: 'ENGINE OIL 1 LITRE BOTTLE',
      type: 'FINISHED',
      unit_name: 'PCS',
      hsn_code: '2710',
      gst_rate: 18,
      purchase_price: 0,
      sale_price: 250,
      reorder_level: 50,
      recipe_output_qty: 1,
      units_per_box: 12
    }
  ]
  return exportRows(win, 'Products', 'PRODUCTS_TEMPLATE.xlsx', PRODUCT_COLUMNS, sample)
}

export async function importProducts(win: BrowserWindow | null): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  const res = await dialog.showOpenDialog(win ?? undefined!, {
    title: 'IMPORT PRODUCTS',
    properties: ['openFile'],
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }]
  })
  if (res.canceled || !res.filePaths[0]) return result

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(res.filePaths[0])
  const ws = wb.worksheets[0]
  if (!ws) {
    result.errors.push('NO SHEET FOUND IN FILE')
    return result
  }

  // Map header text -> column index
  const headerRow = ws.getRow(1)
  const colIndex: Record<string, number> = {}
  headerRow.eachCell((cell, col) => {
    colIndex[UP(cell.value).replace(/\s*\(.*\)\s*/g, '')] = col
  })

  const units = unitRepo.list() as Array<{ id: number; name: string }>
  const unitByName = new Map(units.map((u) => [u.name, u.id]))

  const cellVal = (row: ExcelJS.Row, header: string): unknown => {
    const idx = colIndex[header]
    return idx ? row.getCell(idx).value : undefined
  }

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const code = UP(cellVal(row, 'CODE'))
    const name = UP(cellVal(row, 'NAME'))
    if (!code || !name) {
      result.skipped++
      continue
    }
    try {
      const type = UP(cellVal(row, 'TYPE')) === 'FINISHED' ? 'FINISHED' : 'RAW'
      const unitName = UP(cellVal(row, 'UNIT')) || 'PCS'
      let unitId = unitByName.get(unitName)
      if (!unitId) {
        const created = unitRepo.create(unitName) as { id: number }
        unitId = created.id
        unitByName.set(unitName, unitId)
      }
      const payload = {
        code,
        name,
        type,
        unit_id: unitId,
        hsn_code: UP(cellVal(row, 'HSN_CODE')),
        gst_rate: NUM(cellVal(row, 'GST_RATE')),
        purchase_price: NUM(cellVal(row, 'PURCHASE_PRICE')),
        sale_price: NUM(cellVal(row, 'SALE_PRICE')),
        reorder_level: NUM(cellVal(row, 'REORDER_LEVEL')),
        recipe_output_qty: NUM(cellVal(row, 'RECIPE_OUTPUT_QTY')) || 1,
        units_per_box: NUM(cellVal(row, 'UNITS_PER_BOX')) || 1,
        is_active: 1
      }
      const existing = all<{ id: number }>('SELECT id FROM products WHERE code = ?', [code])[0]
      if (existing) {
        productRepo.update(existing.id, payload as any)
        result.updated++
      } else {
        productRepo.create(payload as any)
        result.inserted++
      }
    } catch (e: any) {
      result.errors.push(`ROW ${i}: ${UP(e?.message ?? 'ERROR')}`)
    }
  }
  run('SELECT 1') // no-op to keep db handle warm
  save()
  return result
}
