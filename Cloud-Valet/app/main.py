from fastapi import FastAPI, Depends, HTTPException, Request, Form, Cookie
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from db import engine, Base, SessionLocal
import models
from sqlalchemy.future import select
from starlette.status import HTTP_302_FOUND
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
templates = Jinja2Templates(directory="templates")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Ensure admin user exists
    async with SessionLocal() as db:
        result = await db.execute(select(models.User).where(models.User.username == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin_user = models.User(username="admin", password_hash=pwd_context.hash("admin123"), permission="Admin")
            db.add(admin_user)
            await db.commit()

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()

@app.get("/")
async def root():
    return {"message": "Cloud Valet API is running!"}

# User CRUD
@app.post("/users/")
async def create_user(username: str = Form(...), email: str = Form(...), password: str = Form(...), permission: str = Form(None), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(models.User).where(models.User.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    if not permission:
        permission = "Read"
    user = models.User(username=username, email=email, password_hash=pwd_context.hash(password), permission=permission)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"username": user.username, "email": user.email, "permission": user.permission}

@app.get("/users/")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    return [{"username": u.username, "email": u.email, "permission": u.permission or "Read"} for u in users]

@app.get("/users/me")
async def get_current_user(user: str = Cookie(None), db: AsyncSession = Depends(get_db)):
    print(f"/users/me: Raw cookie value received: {user!r}")
    if not user:
        print("/users/me: No user cookie found")
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    print(f"/users/me: DB lookup for username={user!r} result: {user_obj}")
    if not user_obj:
        print(f"/users/me: User not found in DB: {user!r}")
        raise HTTPException(status_code=404, detail="User not found")
    print(f"/users/me: Returning user={user_obj.username}, permission={user_obj.permission}")
    # Always fetch permission from DB column
    return {
        "username": user_obj.username,
        "email": user_obj.email,
        "permission": user_obj.permission or "Read"
    }

@app.get("/users/{username}")
async def get_user_by_username(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"username": user.username, "email": user.email, "permission": user.permission or "Read"}

@app.delete("/users/{username}")
async def delete_user(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

@app.put("/users/{username}")
async def update_user(
    username: str,
    new_username: str = Form(...),
    email: str = Form(...),
    permission: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.User).where(models.User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # If username is changed, check for uniqueness
    if new_username != username:
        existing = await db.execute(select(models.User).where(models.User.username == new_username))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = new_username
    user.email = email
    if permission:
        user.permission = permission
    elif not user.permission:
        user.permission = "Read"
    await db.commit()
    await db.refresh(user)
    return {"username": user.username, "email": user.email, "permission": user.permission}

# Group CRUD
@app.post("/groups/")
async def create_group(name: str, db: AsyncSession = Depends(get_db)):
    group = models.Group(name=name)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group

@app.get("/groups/")
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Group))
    return result.scalars().all()

@app.delete("/groups/{name}")
async def delete_group(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Group).where(models.Group.name == name))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
    await db.commit()
    return {"ok": True}

# Tag CRUD
@app.post("/tags/")
async def create_tag(name: str, db: AsyncSession = Depends(get_db)):
    tag = models.Tag(name=name)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag

@app.get("/tags/")
async def list_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Tag))
    return result.scalars().all()

@app.delete("/tags/{name}")
async def delete_tag(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Tag).where(models.Tag.name == name))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
    return {"ok": True}

# VM CRUD
@app.post("/vms/")
async def create_vm(name: str, db: AsyncSession = Depends(get_db)):
    vm = models.VM(name=name)
    db.add(vm)
    await db.commit()
    await db.refresh(vm)
    return vm

@app.get("/vms/")
async def list_vms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.VM))
    return result.scalars().all()

@app.delete("/vms/{name}")
async def delete_vm(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.VM).where(models.VM.name == name))
    vm = result.scalar_one_or_none()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    await db.delete(vm)
    await db.commit()
    return {"ok": True}

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error": None})

@app.post("/login", response_class=HTMLResponse)
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    print(f"/login: Attempt login for username={username!r}")
    async with SessionLocal() as db:
        result = await db.execute(select(models.User).where(models.User.username == username))
        user = result.scalar_one_or_none()
        print(f"/login: DB lookup for username={username!r} result: {user}")
        if user and pwd_context.verify(password, user.password_hash):
            response = RedirectResponse(url="/dashboard", status_code=HTTP_302_FOUND)
            response.set_cookie(key="user", value=username)
            print(f"/login: Login successful, setting cookie user={username!r}")
            return response
        print(f"/login: Login failed for username={username!r}")
        return templates.TemplateResponse("login.html", {"request": request, "error": "Invalid credentials"})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    user = request.cookies.get("user")
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user})

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=HTTP_302_FOUND)
    response.delete_cookie(key="user")
    return response
