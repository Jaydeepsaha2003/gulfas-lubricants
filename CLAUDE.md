# Gulfas Lubricants — Production & Sales Management

A local-first **Electron desktop app** for a lubricants-oil manufacturing business:
buy raw materials (multi-vendor) → produce finished goods from recipes → sell with GST
invoices → track inventory, profit/loss, and expenses.

## Tech stack

- **Electron** + **electron-vite** (Vite) — desktop shell & bundling
- **React 18 + TypeScript** — UI
- **Tailwind CSS v3 + shadcn/ui** — design system (components in `src/renderer/src/components/ui`)
- **sql.js** (SQLite compiled to WebAssembly) — local relational DB, **no native build needed**
- **ExcelJS** — Excel import/export (runs in main process)
- **react-router-dom** (HashRouter), **sonner** (toasts), **lucide-react** (icons), **recharts** (charts)

## Why sql.js (not better-sqlite3)

The target machine has **no MSVC (`cl.exe`)**, so native C++ modules can't compile. sql.js is pure
WASM — installs and runs anywhere. The DB lives in memory and is persisted to a single file:
`%APPDATA%/gulfas-lubricants/gulfas.sqlite`. Every mutation calls `save()` which writes the whole
file (fine for a single-business dataset). If the app ever outgrows this, swap the engine behind the
repos in `src/main/db.ts` — nothing else needs to change.

## Architecture

```
src/
  shared/types.ts        # domain types shared by main + renderer
  main/
    index.ts             # Electron entry: window + app lifecycle
    db.ts                # sql.js init, schema, seed, FIFO helpers, repositories, persistence
    excel.ts             # ExcelJS import/export + native file dialogs
    ipc.ts               # ipcMain.handle channels (one per repo method)
  preload/
    index.ts             # contextBridge -> window.api (namespaced, typed)
    index.d.ts           # global Window.api type
  renderer/
    index.html
    src/
      main.tsx, App.tsx  # router + providers
      lib/               # utils, nav config, company-context
      components/ui/      # shadcn primitives
      components/common/  # Field (label + * marker), UpperInput, PageHeader
      components/layout/  # Sidebar, AppLayout
      pages/             # Dashboard, Settings, Inventory, ComingSoon, ...
```

**Data flow:** renderer → `window.api.<domain>.<method>()` → `ipcRenderer.invoke` →
`ipcMain.handle` (in `ipc.ts`) → repo function (in `db.ts`). Every IPC call returns a
`{ ok: true, data }` / `{ ok: false, error }` envelope; the preload unwraps it and throws on error,
so renderer code can just `try/await/catch` and `toast.error(e.message)`.

## Non-negotiable conventions (from the product owner)

1. **UPPERCASE everywhere.** All text data is stored upper-cased. Use `<UpperInput>` for every text
   field (it upper-cases as you type). Excel import also upper-cases text. Numbers use plain `<Input type="number">`.
2. **Mandatory fields show a red `*`.** Use `<Field label="..." required>` — it renders the asterisk
   and shows the error. Validate required fields before saving and `toast.error` if any are blank.
3. **Excel everywhere.** Every master/entry screen should offer Download (export), a Template, and
   Upload (import). Use `window.api.excel.*`.
4. **Opening stock** is supported via `openingStockRepo.save` → creates `OPENING` FIFO lots.
5. **Master codes are auto-generated** and read-only in the UI — `productRepo.nextCode(type)`
   (`RM-####` / `FG-####`), `vendorRepo.nextCode()` (`VEN-####`), `customerRepo.nextCode()`
   (`CUS-####`). Sequence = max existing suffix + 1.
6. **Document numbers** (sales invoice; purchase/production/expense voucher) follow
   `company.doc_numbering`: `AUTOMATIC` → generated (`nextVoucher`/`nextInvoice`) and read-only;
   `MANUAL` → user types it (required). Sales/Purchase support **multiple line items** per document.
7. **DB migrations** are additive: `migrate()` in `db.ts` calls `ensureColumn()` to add new columns
   to existing databases (since `CREATE TABLE IF NOT EXISTS` won't alter an existing table).

## Business rules

- **GST: Full India model** — products carry `hsn_code` + `gst_rate`; sales/purchases split into
  CGST/SGST (intra-state) or IGST (inter-state) based on company vs party `state_code`.
  Company `gst_pricing_mode` = `INCLUSIVE` or `EXCLUSIVE`.
- **Costing: FIFO.** Stock is held in dated `stock_lots` (qty_remaining + unit_cost). `consumeFIFO()`
  draws from oldest lots first; `addLot()` adds stock. Production and Sales use these for true cost.
- **Recipes (BOM): fixed per finished product** in `product_recipes`, editable per production batch
  (the Production dialog pre-fills scaled quantities but each can be overridden; the override is sent
  as `inputs` to `productionRepo.create`). `products.recipe_output_qty` = standard units per recipe run.
- **Packaging / box selling.** Finished products carry `products.units_per_box`. A sale line can be
  `EACH` or `BOX`; choosing BOX multiplies quantity by the pack size to get base units, which is what
  FIFO consumes. `sale_items` stores `uom` + `pack_size` + `base_quantity`; quantity-based reports use
  `base_quantity`.

## Commands

```bash
npm run dev        # launch app with hot reload
npm run build      # type-aware bundle of main/preload/renderer
npm run typecheck  # tsc for node + web projects
npm run build:win  # build + package a Windows installer (electron-builder)
```

## Build roadmap / status

- [x] **M1 Foundation** — app shell, nav, theme, DB + full schema, IPC, UpperInput/`*`, Excel engine, **Settings**, Inventory view, Dashboard
- [x] **M2 Product Master** — raw + finished products, BOM editor, opening stock, Excel import/export; Vendors & Customers masters
- [x] **M3 Purchase** — multi-vendor purchase entry → FIFO lots, GST (CGST/SGST/IGST)
- [x] **M4 Production** — batch run against recipe, FIFO consume → finished lots at true cost
- [x] **M5 Sales** — GST invoices, FIFO COGS, per-invoice profit
- [x] **M6 Profit/Loss + Business Expenses + Dashboard P&L cards + monthly chart**
- [x] **M7 Windows build** — electron-builder **portable .exe** + GitHub Actions release on tag
- [x] **M8 Edit/delete** — Purchase/Production/Sales/Expenses are editable & deletable with FIFO stock reversal (delete/edit blocked if a purchase's stock or a batch's output was already consumed downstream)
- [x] **M9 Unregistered parties + searchable selects** — vendors/customers carry `gst_registered` (0 = no GST → GSTIN cleared & disabled); all record-pick dropdowns (party, product, unit, material, category) use the searchable `<Combobox>`
- [x] **M10 P&L layout + categories + storage tools** — P&L statement order (Purchases → Production Cost → Sales → Stock in Hand → Gross Profit → Business Expense → Net Profit) on Dashboard & P&L page; `product_categories` master (OIL/CAP/BOTTLE/SEAL…) with `products.category_id`; opening-stock RAW/FINISHED filter; **movable DB file** (`config.json` points at the sqlite — pick a Google-Drive folder via `setDbLocation`); **delete-all-data** (`resetData` wipes business data, keeps company/settings/units/categories); Purchase shows RAW only, Sales shows FINISHED only
- [ ] _Future:_ PDF invoice printing, GSTR-style tax reports, custom app icon, data backup/restore UI

All transaction logic (FIFO, GST split, production costing, P&L) is covered by an integration
test scenario — see git history (`_dbtest.cjs` harness) for the verified numbers.
```
