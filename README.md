# Cloud Valet FastAPI Scaffold

[![CI](https://github.com/patilk234/cloud-valet/actions/workflows/ci.yml/badge.svg)](https://github.com/patilk234/cloud-valet/actions/workflows/ci.yml)

## Features
- FastAPI backend
- PostgreSQL database (Dockerized)
- SQLAlchemy async ORM
- User, Group, Tag, VM models

## Getting Started

1. Build and start the stack:

```bash
docker-compose up --build
```

2. The API will be available at [http://localhost:8000](http://localhost:8000)

3. The database will be available at `localhost:5432` (user: cloudvalet, pass: cloudvaletpass, db: cloudvaletdb)

## Project Structure

- `app/` - FastAPI app code
  - `main.py` - FastAPI entrypoint
  - `db.py` - Database connection
  - `models.py` - ORM models
  - `requirements.txt` - Python dependencies
- `docker-compose.yml` - Multi-container setup
- `app/Dockerfile` - FastAPI app container

## Running Tests

### Backend

```bash
cd Cloud-Valet/app
pip install -r ../requirements.txt
pip install pytest pytest-asyncio httpx
pytest
```

### Frontend

```bash
cd cloud-valet-frontend
npm install
npm test
```

All tests are run automatically in CI on every pull request.

## Next Steps
- Add API endpoints for user/group/tag/vm management
- Implement authentication
- Add scheduling logic
- Integrate with Azure, AWS, GCP, Heroku
