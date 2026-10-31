# SteepX

> A modern subscription and billing management platform built with FastAPI, Next.js, and PostgreSQL.

---

## 📖 Overview

**SteepX** is a full-stack platform designed for managing subscriptions, billing, and customer workflows. It features a high-performance Python backend paired with a responsive Next.js frontend and containerized database infrastructure.

- **Backend API**: Fast, reliable REST API built with **FastAPI**, **Pydantic**, and **PostgreSQL**.
- **Frontend**: Dynamic, responsive user interface built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **shadcn/ui**.
- **Database & Services**: **PostgreSQL 17** containerized with **Docker Compose**.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components & Icons**: [shadcn/ui](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/)
- **Charts & Visualization**: [Recharts](https://recharts.org/)
- **HTTP Client**: [Axios](https://axios-http.com/)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
- **Database / Driver**: [PostgreSQL 17](https://www.postgresql.org/), [Psycopg 3](https://www.psycopg.org/)
- **Migrations / Data**: Alembic, Pydantic
- **Security & Auth**: Argon2, JWT (HS256)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 17

---

## 📁 Project Structure

```text
SteepX/
├── backend/                  # FastAPI backend application
│   ├── main.py               # Application entrypoint & API routes
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js App Router (pages & layouts)
│   │   ├── components/       # Reusable React components & UI primitives
│   │   └── lib/              # Client utilities and helpers
│   ├── package.json          # Node.js dependencies and scripts
│   └── tsconfig.json         # TypeScript configuration
├── docker-compose.yml        # Docker Compose configuration (PostgreSQL)
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure the following tools are installed on your machine:
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (v18 or higher recommended) & `npm`
- [Python](https://www.python.org/) (v3.10 or higher) & `pip`
- [Docker & Docker Desktop](https://www.docker.com/)

---

### 1. Environment Configuration

Create a local `.env` file from the provided template:

```bash
# Windows PowerShell:
Copy-Item .env.example .env

# Linux / macOS / Git Bash:
cp .env.example .env
```

Review `.env` and update secrets and configuration parameters as appropriate.

---

### 2. Start Database (PostgreSQL via Docker)

Launch the PostgreSQL container using Docker Compose:

```bash
docker compose up -d postgres
```

The database container runs on port `5433` (mapped to PostgreSQL default `5432` internally).

To check container status:
```bash
docker compose ps
```

---

### 3. Backend Setup & Run

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. The API is now accessible:
   - **Base URL**: `http://localhost:8000`
   - **Health Check**: `http://localhost:8000/api/v1/health`
   - **Swagger UI**: `http://localhost:8000/docs`
   - **ReDoc**: `http://localhost:8000/redoc`

---

### 4. Frontend Setup & Run

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Health check endpoint returning API status |
| `GET` | `/docs` | Interactive Swagger API documentation |
| `GET` | `/redoc` | ReDoc alternative API documentation |

---

## 📜 Development Scripts

### Frontend
- `npm run dev` - Launch development server on `http://localhost:3000`
- `npm run build` - Create production build
- `npm run start` - Launch production server
- `npm run lint` - Run ESLint checks

### Backend
- `uvicorn main:app --reload --port 8000` - Run FastAPI with auto-reload
