# سیستەمی یەکگرتووی بەڕێوەبردنی کتێبخانەی حەیدەری

**Haidari Library — Unified Library & Cafeteria Management System**

A full-stack management system for a library + cafeteria business with a single
centralized accounting core. Built with **React + Node.js/Express + PostgreSQL**.

## Features / تایبەتمەندییەکان

- **بەڕێوەبردنی کتێب (Library):** Books with author, translator, category, edition,
  publisher place, supplier, cost/sale price, stock, ISBN/barcode.
- **کۆگای تایبەت (Acquisition tracking):** Purchased, free-received-for-sale, free
  gift, and purchased-then-gifted items are all tracked separately.
- **بەڕێوەبردنی کافتریا (Cafeteria):** Coffee, tea, sweets, cold drinks and other
  products with full inventory + sales.
- **POS بە بارکۆد:** Barcode scan checkout, barcode generation/printing, real-time
  stock updates, receipt printing.
- **داشکاندن و پڕۆمۆشن:** Per-product, percentage, fixed-amount and loyalty discounts.
- **ژمێریاری ناوەندی (Accounting):** Income, expenses, purchases, supplier payables,
  profit & loss, cash flow, per-category analysis.
- **فرۆشتنی ماڵپەڕ (Website sales):** Online sales tracked and separated from in-store.
- **داشبۆرد و ڕاپۆرت:** Modern dashboard + advanced filtered reports.
- **کۆپیەدەگ (Backup/restore):** Manual and scheduled database backups.

## Project structure

```
haidari-library-system/
├── server/   # Node.js + Express + PostgreSQL REST API
└── client/   # React (Vite) single-page application
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

### 1. Database

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER haidari WITH PASSWORD 'haidari_dev_pass' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE haidari_library OWNER haidari;"
```

### 2. Backend

```bash
cd server
cp .env.example .env        # adjust if needed
npm install
npm run migrate             # create tables
npm run seed                # demo data + admin user
npm run dev                 # http://localhost:4000
```

Default admin login: **admin / admin123**

### 3. Frontend

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

## License

Proprietary — Haidari Library.
