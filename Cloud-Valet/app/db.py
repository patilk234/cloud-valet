from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import dotenv

dotenv.load_dotenv(dotenv.find_dotenv())

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://cloudvalet:cloudvaletpass@db:5432/cloudvaletdb")

engine = create_async_engine(DATABASE_URL, echo=True, future=True)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()
