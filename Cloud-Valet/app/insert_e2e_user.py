# Script to insert a Write user for E2E and CI tests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import models
from passlib.context import CryptContext

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cloudvalet:cloudvaletpass@localhost:55432/cloudvaletdb")
# Patch: ensure we use a sync driver for SQLAlchemy engine
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgresql+asyncpg://"):]

engine = create_engine(DATABASE_URL)
# Ensure all tables exist before inserting user (for CI robustness)
models.Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main():
    db = Session()
    username = "writeuser"
    password = "pw"
    email = "w@x.com"
    permission = "Write"
    user = db.query(models.User).filter_by(username=username).first()
    if not user:
        user = models.User(
            username=username,
            email=email,
            password_hash=pwd_context.hash(password),
            permission=permission
        )
        db.add(user)
        db.commit()
        print("E2E Write user created.")
    else:
        user.password_hash = pwd_context.hash(password)
        user.permission = permission
        db.commit()
        print("E2E Write user password updated.")
    # Print username, password, and hash from DB for debugging
    db_user = db.query(models.User).filter_by(username=username).first()
    print(f"DB user: username={db_user.username}, password_hash={db_user.password_hash}")
    # Verify that the password 'pw' matches the hash in DB
    is_valid = pwd_context.verify("pw", db_user.password_hash)
    print(f"Password verification for 'pw': {is_valid}")
    db.close()

if __name__ == "__main__":
    main()
