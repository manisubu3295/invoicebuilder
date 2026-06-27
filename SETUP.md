# AKB Transport & Logistics — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Docker)
- Git

## 1. Database Setup

### Option A: Docker (recommended)
```bash
docker-compose up -d
```

### Option B: Manual PostgreSQL
Create a database named `akb_transport` and update `backend/.env`.

## 2. Backend Setup

```bash
cd backend
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, EMAIL credentials

# Run migrations (creates all tables)
npx sequelize-cli db:migrate

# Seed default admin user
npx sequelize-cli db:seed:all

npm run dev
```

Backend runs on: http://localhost:5000

**Default Admin Login:**
- Email: `akbtransportlogistics@gmail.com`
- Password: `Admin@AKB2026`

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

## 4. Email Configuration (Gmail)

1. Go to Google Account → Security → App Passwords
2. Create an App Password for "Mail"
3. Set `EMAIL_PASS` in `backend/.env` to the 16-digit app password

## 5. Adding AKB Logo/Stamp to PDF

Place these files in `backend/assets/`:
- `akb-logo.png` — AKB logo (used in PDF top-right)
- `akb-stamp.png` — Company round stamp (used in PDF signature area)

Without these files, the PDF will use a placeholder "AKB" text box.

## Architecture Summary

```
akb-transport/
├── frontend/        Vue 3 + Vite + Tailwind CSS + Pinia
├── backend/         Node.js + Express + Sequelize + PostgreSQL
├── docker-compose.yml
└── SETUP.md
```

## Key Features
- Invoice management with auto-numbering (AKB/SMM/312/2026 format)
- PDF generation matching existing AKB invoice format
- Email delivery with PDF attachment
- Quotation → Invoice conversion
- Delivery job tracking with driver portal
- Fleet management
- Revenue dashboard & reports
