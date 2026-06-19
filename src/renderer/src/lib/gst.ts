export interface LineInput {
  product_id: number | ''
  quantity: string
  rate: string
  gst_rate: string
  uom?: 'EACH' | 'BOX'
}

export interface LineCalc {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export function computeLine(
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
    total: taxable + tax
  }
}

export function summarize(lines: LineInput[], mode: string, interState: boolean): LineCalc {
  return lines.reduce<LineCalc>(
    (acc, l) => {
      const c = computeLine(Number(l.quantity) || 0, Number(l.rate) || 0, Number(l.gst_rate) || 0, mode, interState)
      return {
        taxable: acc.taxable + c.taxable,
        cgst: acc.cgst + c.cgst,
        sgst: acc.sgst + c.sgst,
        igst: acc.igst + c.igst,
        total: acc.total + c.total
      }
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )
}
