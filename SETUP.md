# Cloud Valet Setup & Development Guide

This guide will help you set up and run both the backend (FastAPI) and frontend (React) for Cloud Valet.

---

## Prerequisites

- Python 3.12+
- Node.js (v18+ recommended) & npm
- PostgreSQL (if using Postgres for backend DB)

---

## Backend Setup (FastAPI)

1. **Clone the repository and navigate to the backend directory:**
   ```bash
   cd Cloud-Valet/app
   ```

2. **Create and activate a Python virtual environment:**
   ```bash
   python3.12 -m venv venv312
   source venv312/bin/activate
   ```

3. **Install backend dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   - Copy `.env.example` to `.env` and update DB connection details if needed.
   - Example for SQLite (default):
     ```env
     DATABASE_URL=sqlite+aiosqlite:///./app.db
     ```
   - Example for PostgreSQL:
     ```env
     DATABASE_URL=postgresql+asyncpg://<user>:<password>@localhost/<dbname>
     ```

5. **Initialize the database:**
   - The database tables will be created automatically on first run.

6. **Start the backend server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   - The API will be available at [http://localhost:8000](http://localhost:8000)

---

## Frontend Setup (React)

1. **Navigate to the frontend directory:**
   ```bash
   cd ../cloud-valet-frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend development server:**
   ```bash
   npm start
   ```
   - The UI will be available at [http://localhost:3000](http://localhost:3000)
   - The frontend is configured to proxy API requests to the backend at port 8000.

---

## Development Tips

- **Backend:**
  - Code is in `Cloud-Valet/app/`
  - Main entry: `main.py`
  - To run tests: `pytest`
- **Frontend:**
  - Code is in `cloud-valet-frontend/src/`
  - Main entry: `App.js`
- **Default Admin User:**
  - Username: `admin`
  - Password: `admin123`
  - (Set email for admin manually if needed)

---

## Troubleshooting

- If you see database errors, ensure your `DATABASE_URL` is correct and the DB is running.
- If you see 404s for `/socket.io/`, you can ignore them unless you plan to use real-time features.
- For missing dependencies, re-run the install commands above.

---

## Contact

For help, open an issue or contact the maintainers at support@cloudvalet.com.
