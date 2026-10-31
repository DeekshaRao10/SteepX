# SteepX — SaaS Subscription & Billing Management Platform

A high-performance, full-stack subscription billing, catalog management, and recurring revenue engine built with **FastAPI**, **Next.js 16**, **Tailwind CSS v4**, and **PostgreSQL 17**.

---

## 📖 Overview

**SteepX** is an end-to-end commercial subscription management platform engineered to model realistic SaaS lifecycle workflows — from initial quotation drafting and subscription activation to automated recurring billing, discount/tax calculations, and manual payment reconciliations.

### Key Capabilities
- **🔐 Authentication & RBAC**: Secure role-based access control with Argon2 password hashing and HS256 JWT tokens supporting **Admin**, **Staff**, and **Customer** personas.
- **📦 Catalog & Plans**: Configurable products, add-ons, pricing variants, and recurring billing plans (daily, weekly, monthly, yearly) with plan end behaviors (`renew`, `close`, `pause`).
- **📝 Quotations & Agreements**: Flexible quotes supporting custom itemization, tax rates, and discount vouchers that transition into active subscriptions upon customer confirmation.
- **🔄 Subscription Lifecycle**: State engine managing `draft` → `quotation` → `confirmed` → `active` ↔ `paused` → `closed` lifecycle states with accurate calendar-aligned billing anchors.
- **💳 Invoicing & Billing Engine**: Precision `Decimal` arithmetic (`NUMERIC(20,2)`) ensuring compliant financial rounding, largest-remainder proportional discount allocations, tax computation, and automated overdue tracking.
- **📊 Real-time Dashboard**: Interactive analytics showing MRR/revenue metrics, active subscriptions, customer distributions, and invoice collection statuses.
- **🎨 Modern Frontend**: Built using Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, and Recharts with custom dialogs, modals, and responsive data tables.

---

## 🛠️ Tech Stack

| Domain | Technology / Tools |
| :--- | :--- |
| **Frontend Framework** | [Next.js](https://nextjs.org/) 16 (App Router), [React](https://react.dev/) 19, [TypeScript](https://www.typescriptlang.org/) |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [shadcn/ui](https://ui.shadcn.com/) |
| **Data Visualization** | [Recharts](https://recharts.org/) |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/), Python 3.12, [Pydantic v2](https://docs.pydantic.dev/) |
| **ASGI Server** | [Uvicorn](https://www.uvicorn.org/) |
| **Database & ORM** | [PostgreSQL 17](https://www.postgresql.org/), [SQLAlchemy 2.0](https://www.sqlalchemy.org/), [Psycopg 3](https://www.psycopg.org/) |
| **Database Migrations** | [Alembic](https://alembic.sqlalchemy.org/) |
| **Security & Cryptography** | [Argon2-cffi](https://pypi.org/project/argon2-cffi/), PyJWT (HS256) |
| **Infrastructure** | Docker & Docker Compose |

---

## 📁 Project Structure

```text
SteepX/
├── backend/                          # FastAPI Backend Application
│   ├── app/
│   │   ├── api/v1/endpoints/        # Auth, Billing, Catalog, Commerce, Staff, Health
│   │   ├── core/                    # Config, Security, Billing calendar, Error handlers
│   │   ├── db/                      # SQLAlchemy session & base models
│   │   ├── models/                  # Database models (User, Catalog, Commerce, Billing)
│   │   ├── schemas/                 # Pydantic validation schemas
│   │   └── services/                # Business logic (Pricing, Discounts, Payments, etc.)
│   ├── docs/                        # API spec, business rules, verification reports
│   ├── migrations/                  # Alembic database migrations
│   ├── scripts/                     # Local setup, seeding, and verification scripts
│   ├── tests/                       # Unit, integration, and security test suites
│   ├── main.py                      # FastAPI application entrypoint
│   └── requirements.txt             # Python dependencies
│
├── frontend/                         # Next.js 16 Frontend Application
│   ├── public/                      # Static assets & compiled Tailwind CSS
│   ├── src/
│   │   ├── app/                     # Next.js App Router (Dashboard, Invoices, Plans, etc.)
│   │   ├── components/              # UI components, tables, modals, charts, layout
│   │   ├── context/                 # AuthContext & ToastContext providers
│   │   ├── services/                # API client services & mappers
│   │   └── types/                   # TypeScript interfaces and API schemas
│   ├── build-css.js                 # Tailwind CSS v4 direct compilation script
│   └── package.json                 # Node.js dependencies and scripts
│
├── docker-compose.yml                # PostgreSQL 17 database service
├── .env.example                      # Root environment template
└── README.md                         # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed locally:
- [Docker & Docker Desktop](https://www.docker.com/)
- [Python 3.12](https://www.python.org/) & `pip`
- [Node.js 18+](https://nodejs.org/) & `npm`
- [Git](https://git-scm.com/)

---

### Step 1: Environment Setup

Copy `.env.example` to create `.env` in the root directory:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Review `.env` to verify database credentials and service ports. The default database port is mapped to `5433` on the host to prevent conflicts with any pre-existing local PostgreSQL instances.

---

### Step 2: Start the PostgreSQL Database

Start the PostgreSQL 17 container in detached mode:

```bash
docker compose up -d postgres
```

Verify the container is healthy:
```bash
docker compose ps
```

---

### Step 3: Backend Setup & Execution

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Run database migrations and bootstrap:
   ```powershell
   # Apply database migrations
   python -m scripts.migrate_local

   # (Optional) Seed realistic demo records (Catalog, Plans, Customers, Subscriptions)
   python -m scripts.seed_demo
   ```

5. Launch the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. The backend API is now running at `http://localhost:8000`:
   - **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
   - **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Step 4: Frontend Setup & Execution

1. Open a new terminal window and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Compile Tailwind CSS and start the development server:
   ```bash
   npm run dev
   ```

4. Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 👥 Default Roles & Authentication

SteepX provides role-isolated permissions:

| Role | Permissions & Scope |
| :--- | :--- |
| **Admin** | Full system access: manage staff, tax rules, discount vouchers, system configurations, and demo seed data. |
| **Staff** | Operational access: manage product catalog, plans, view customer profiles, create quotations, and record payments. |
| **Customer** | Self-service portal: view subscribed plans, inspect quotations, download invoices, and manage active subscriptions. |

> **Note**: To generate local demo credentials safely, run `python -m scripts.seed_demo`. The script writes securely formatted credentials for testing under `backend/tmp/`.

---

## 📡 API Overview

The backend exposes RESTful endpoints versioned under `/api/v1`:

- **Auth**: `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/me`
- **Catalog**: `/api/v1/catalog/products`, `/api/v1/catalog/plans`, `/api/v1/catalog/variants`
- **Commerce**: `/api/v1/commerce/quotations`, `/api/v1/commerce/subscriptions`
- **Billing**: `/api/v1/billing/invoices`, `/api/v1/billing/invoices/{id}/pay`
- **Discounts & Taxes**: `/api/v1/billing/discounts`, `/api/v1/billing/taxes`
- **Finance**: `/api/v1/billing/finance/summary`, `/api/v1/billing/finance/reports`

For complete endpoint contracts and response schemas, view the [Swagger UI](http://localhost:8000/docs).

---

## 🧪 Testing & Verification

Run the test and verification suites from the `backend/` directory:

```bash
# Run automated pytest test suite
pytest

# Verify business and HTTP contracts
python -m scripts.verify_business_http

# Verify Phase 3-8 endpoints and lifecycle behavior
python -m scripts.verify_development_demo
```

---

## 📄 License

This project is licensed under the MIT License.
