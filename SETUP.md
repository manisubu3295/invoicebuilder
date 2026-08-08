# Aadhirai Transport & Logistics — Setup Guide

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
Create a database named `aadhirai_transport_demo` and update `backend/.env`.

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
- Username: `admin`
- Password: `Admin@Demo2026`

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

## 5. Adding a Logo/Stamp to PDFs

Place these files in `backend/assets/`:
- `logo.png` — company logo (used in PDF top-right)
- `stamp.png` — company round stamp (used in PDF signature area)

Without these files, the PDF will use a placeholder text box built from Settings' "Logo Initials".

## Architecture Summary

```
quotation/
├── frontend/        Vue 3 + Vite + Tailwind CSS + Pinia
├── backend/         Node.js + Express + Sequelize + PostgreSQL
├── docker-compose.yml
└── SETUP.md
```

## Key Features
- Invoice management with configurable auto-numbering (`PREFIX-0001` format)
- PDF generation with company branding pulled from Settings
- Email delivery with PDF attachment
- Quotation → Invoice conversion
- Delivery job tracking with driver portal
- Fleet management
- Revenue dashboard & reports
