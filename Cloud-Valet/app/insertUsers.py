from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

for i in range(1, 31):
    username = f"user{i}"
    email = f"{username}@abc.com"
    password = f"{username}123"
    password_hash = pwd_context.hash(password)
    print(f"INSERT INTO \"users\" (username, email, password_hash, permission) VALUES ('{username}', '{email}', '{password_hash}', 'Read');")