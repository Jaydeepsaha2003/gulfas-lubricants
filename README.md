# Gulfas Lubricants — Production & Sales Management

A local-first **Windows desktop app** for a lubricants-oil manufacturing business. Buy raw materials
from multiple vendors, produce finished goods from recipes, sell with GST invoices, and track
inventory and profit/loss — all offline, with your data stored on your own machine.

## Features

- **Dashboard** — stock value, low-stock alerts, getting-started checklist
- **Product Master** — raw materials & finished products, **recipes (Bill of Materials)**, **opening stock**, Excel import/export
- **Vendors & Customers** — with GSTIN and state for correct GST treatment
- **Purchase** — multi-vendor purchase entry; each line creates a dated FIFO stock lot with GST
- **Production** — run a batch against a recipe; raw materials are consumed oldest-first and finished goods are costed automatically
- **Sales** — GST invoices with CGST/SGST (intra-state) or IGST (inter-state); cost of goods from FIFO so per-invoice profit is accurate
- **Inventory** — live stock valued at **FIFO** cost, Raw / Finished views, Excel export
- **Business Expenses** — categorised running costs
- **Profit & Loss** — revenue − COGS − expenses for any date range, with a monthly revenue/cost chart
- **Settings** — company profile, logo, address, **Full India GST** (HSN, CGST/SGST/IGST), inclusive/exclusive pricing

Built-in conventions: every text field is stored **UPPERCASE**, mandatory fields are marked with a
red **\***, and Excel download/upload is available on data screens.

## Tech

Electron · React + TypeScript · Tailwind CSS + shadcn/ui · SQLite (sql.js / WebAssembly) · ExcelJS · Inter font

## Run in development

```bash
npm install
npm run dev
```

## Build the Windows installer (.exe)

**Locally:**

```bash
npm run build:win
```

The installer is written to `release/Gulfas-Lubricants-<version>-Setup.exe`.

**Automatically via GitHub Actions:** push a version tag and the workflow builds the installer and
attaches it to a GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

You can also trigger a build manually from the **Actions** tab (Run workflow) — the installer is then
available as a downloadable build artifact.

## Where is my data?

A single SQLite file at `%APPDATA%\gulfas-lubricants\gulfas.sqlite`. Back it up by copying that file.

---

See [CLAUDE.md](CLAUDE.md) for architecture and developer notes.
