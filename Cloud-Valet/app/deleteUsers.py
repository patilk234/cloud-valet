from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

for i in range(1, 31):
    username = f"user{i}"
    print(f"DELETE FROM \"users\" WHERE username = '{username}';")