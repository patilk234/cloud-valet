from fastapi import FastAPI, Depends, HTTPException, Request, Form, Cookie, Body
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from db import engine, Base, SessionLocal
import models
from sqlalchemy.future import select
from starlette.status import HTTP_302_FOUND
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
from cryptography.fernet import Fernet
import os, json, datetime
from dotenv import load_dotenv
from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
import asyncio

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

load_dotenv()  # Load .env file at startup

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
    # Ensure E2E Write user exists
    async with SessionLocal() as db:
        result = await db.execute(select(models.User).where(models.User.username == "writeuser"))
        writeuser = result.scalar_one_or_none()
        if not writeuser:
            user = models.User(
                username="writeuser",
                email="w@x.com",
                password_hash=pwd_context.hash("pw"),
                permission="Write"
            )
            db.add(user)
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

# Change password
@app.post("/users/{username}/password")
async def change_password(
    username: str,
    old_password: str = Body(...),
    new_password: str = Body(...),
    user: str = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    # Only allow user to change their own password
    if user != username:
        raise HTTPException(status_code=403, detail="You can only change your own password")
    result = await db.execute(select(models.User).where(models.User.username == username))
    user_obj = result.scalar_one_or_none()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")
    if not pwd_context.verify(old_password, user_obj.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    user_obj.password_hash = pwd_context.hash(new_password)
    await db.commit()
    return {"ok": True, "message": "Password updated"}

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
            response.set_cookie(key="user", value=username, httponly=False, samesite="lax", secure=False)
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

PROVIDER_SECRET_FILE = "azure_provider_secret.json"
PROVIDER_SECRET_META_FILE = "azure_provider_secret_meta.json"
FERNET_KEY_FILE = "fernet.key"

def get_fernet():
    if not os.path.exists(FERNET_KEY_FILE):
        key = Fernet.generate_key()
        with open(FERNET_KEY_FILE, "wb") as f:
            f.write(key)
    else:
        with open(FERNET_KEY_FILE, "rb") as f:
            key = f.read()
    return Fernet(key)

def save_provider_secret(data):
    f = get_fernet()
    encrypted = f.encrypt(json.dumps(data).encode())
    with open(PROVIDER_SECRET_FILE, "wb") as out:
        out.write(encrypted)
    # Save/update last_updated timestamp
    meta = {"last_updated": datetime.datetime.utcnow().isoformat() + "Z"}
    with open(PROVIDER_SECRET_META_FILE, "w") as meta_out:
        json.dump(meta, meta_out)

def load_provider_secret():
    if not os.path.exists(PROVIDER_SECRET_FILE):
        return None
    f = get_fernet()
    with open(PROVIDER_SECRET_FILE, "rb") as inp:
        encrypted = inp.read()
    try:
        decrypted = f.decrypt(encrypted)
        data = json.loads(decrypted.decode())
        # Attach last_updated if available
        if os.path.exists(PROVIDER_SECRET_META_FILE):
            with open(PROVIDER_SECRET_META_FILE, "r") as meta_in:
                meta = json.load(meta_in)
                data["last_updated"] = meta.get("last_updated")
        return data
    except Exception:
        return None

from fastapi import status

@app.post("/provider/azure")
async def save_azure_provider(
    client_id: str = Form(...),
    tenant_id: str = Form(...),
    client_secret: str = Form(...),
    user: str = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    # Only admin can save
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    if not user_obj or user_obj.permission != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    save_provider_secret({
        "clientId": client_id,
        "tenantId": tenant_id,
        "clientSecret": client_secret
    })
    # Return last_updated timestamp
    meta = {"last_updated": datetime.datetime.utcnow().isoformat() + "Z"}
    return {"ok": True, **meta}

@app.get("/provider/azure")
async def get_azure_provider(user: str = Cookie(None), db: AsyncSession = Depends(get_db)):
    # Only admin can get provider info (even without secret)
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    if not user_obj or user_obj.permission != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    secret = load_provider_secret()
    if not secret:
        return {"clientId": "", "tenantId": "", "last_updated": None}
    # Never return clientSecret in GET
    return {
        "clientId": secret.get("clientId", ""),
        "tenantId": secret.get("tenantId", ""),
        "last_updated": secret.get("last_updated")
    }

MOCK_MODE = os.environ.get("MOCK_AZURE", "0") == "1"

@app.get("/azure/vms")
async def list_azure_vms(user: str = Cookie(None), db: AsyncSession = Depends(get_db)):
    # Allow all authenticated users to view VMs
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    if not user_obj:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if MOCK_MODE:
        # Return mock data
        return {
            "vms": [
                {
                    "id": "/subscriptions/mock/resourceGroups/mock-group/providers/Microsoft.Compute/virtualMachines/mock-vm1",
                    "name": "mock-vm1",
                    "location": "eastus",
                    "type": "Microsoft.Compute/virtualMachines",
                    "resourceGroup": "mock-group",
                    "status": "VM deallocated"
                },
                {
                    "id": "/subscriptions/mock/resourceGroups/mock-group/providers/Microsoft.Compute/virtualMachines/mock-vm2",
                    "name": "mock-vm2",
                    "location": "westus",
                    "type": "Microsoft.Compute/virtualMachines",
                    "resourceGroup": "mock-group",
                    "status": "VM running"
                },
                {
                    "id": "/subscriptions/mock/resourceGroups/mock-group/providers/Microsoft.Compute/virtualMachines/mock-vm3",
                    "name": "mock-vm3",
                    "location": "centralus",
                    "type": "Microsoft.Compute/virtualMachines",
                    "resourceGroup": "mock-group",
                    "status": "VM stopped"
                }
            ]
        }
    secret = load_provider_secret()
    if not secret:
        raise HTTPException(status_code=400, detail="Azure credentials not set")
    client_id = secret.get("clientId")
    tenant_id = secret.get("tenantId")
    client_secret = secret.get("clientSecret")
    subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID")
    if not all([client_id, tenant_id, client_secret, subscription_id]):
        raise HTTPException(status_code=400, detail="Missing Azure credentials or subscription ID")
    try:
        credential = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
        compute_client = ComputeManagementClient(credential, subscription_id)
        vms = []
        for vm in compute_client.virtual_machines.list_all():
            # Get resource group from ID
            resource_group = vm.id.split("/")[4] if vm.id else ""
            # Get power state (status)
            instance_view = compute_client.virtual_machines.instance_view(resource_group, vm.name)
            status = None
            for s in instance_view.statuses:
                if s.code.startswith("PowerState/"):
                    status = s.display_status
                    break
            vms.append({
                "id": vm.id,
                "name": vm.name,
                "location": vm.location,
                "type": vm.type,
                "resourceGroup": resource_group,
                "status": status or "Unknown"
            })
        return {"vms": vms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Azure API error: {str(e)}")

@app.post("/azure/vm/action")
async def vm_action(
    user: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
    body: dict = Body(None)
):
    # Always check permission first, even if body is missing
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    perm = (user_obj.permission if user_obj else None) or "Read"
    if not user_obj or perm not in ("Write", "Admin"):
        # Defensive: always return 403 in MOCK_MODE, never raise any other error
        if MOCK_MODE:
            return JSONResponse(status_code=403, content={"detail": "Write or Admin only [MOCK]"})
        raise HTTPException(status_code=403, detail="Write or Admin only")
    if not body:
        raise HTTPException(status_code=400, detail="Missing request body")
    vm_name = body.get("name")
    resource_group = body.get("resourceGroup")
    action = body.get("action")
    if not (vm_name and resource_group and action):
        raise HTTPException(status_code=400, detail="Missing VM name, resource group, or action")
    if MOCK_MODE:
        return {"ok": True, "message": f"[MOCK] {action} performed on {vm_name}"}
    secret = load_provider_secret()
    if not secret:
        raise HTTPException(status_code=400, detail="Azure credentials not set")
    client_id = secret.get("clientId")
    tenant_id = secret.get("tenantId")
    client_secret = secret.get("clientSecret")
    subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID")
    if not all([client_id, tenant_id, client_secret, subscription_id]):
        raise HTTPException(status_code=400, detail="Missing Azure credentials or subscription ID")
    try:
        credential = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
        compute_client = ComputeManagementClient(credential, subscription_id)
        if action == "start":
            poller = compute_client.virtual_machines.begin_start(resource_group, vm_name)
            poller.wait()
        elif action == "deallocate":
            poller = compute_client.virtual_machines.begin_deallocate(resource_group, vm_name)
            poller.wait()
        elif action == "poweroff":
            poller = compute_client.virtual_machines.begin_power_off(resource_group, vm_name)
            poller.wait()
        elif action == "restart":
            poller = compute_client.virtual_machines.begin_restart(resource_group, vm_name)
            poller.wait()
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        # After action, fetch updated VM info
        vm = compute_client.virtual_machines.get(resource_group, vm_name)
        instance_view = compute_client.virtual_machines.instance_view(resource_group, vm_name)
        statuses = instance_view.statuses if hasattr(instance_view, 'statuses') else []
        status = next((s.display_status for s in statuses if s.code.startswith('PowerState')), 'Unknown')
        vm_data = {
            'name': vm.name,
            'resourceGroup': resource_group,
            'location': vm.location,
            'status': status,
        }
        return vm_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Azure API error: {str(e)}")

@app.post("/azure/vms/bulk_action")
async def vms_bulk_action(
    user: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
    body: dict = Body(...)
):
    # Allow Write and Admin users to perform actions
    result = await db.execute(select(models.User).where(models.User.username == user))
    user_obj = result.scalar_one_or_none()
    perm = (user_obj.permission if user_obj else None) or "Read"
    if not user_obj or perm not in ("Write", "Admin"):
        # If MOCK_MODE, always return a mock 403 for forbidden users
        if MOCK_MODE:
            return JSONResponse(status_code=403, content={"detail": "Write or Admin only [MOCK]"})
        raise HTTPException(status_code=403, detail="Write or Admin only")
    if MOCK_MODE:
        names = body.get("names", [])
        action = body.get("action")
        return [
            {"name": name, "resourceGroup": "mock-rg", "location": "mock-loc", "status": f"[MOCK] {action}"}
            for name in names
        ]
    secret = load_provider_secret()
    if not secret:
        raise HTTPException(status_code=400, detail="Azure credentials not set")
    client_id = secret.get("clientId")
    tenant_id = secret.get("tenantId")
    client_secret = secret.get("clientSecret")
    subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID")
    if not all([client_id, tenant_id, client_secret, subscription_id]):
        raise HTTPException(status_code=400, detail="Missing Azure credentials or subscription ID")
    vms = body.get("vms", [])
    action = body.get("action")
    if not vms or not action:
        raise HTTPException(status_code=400, detail="Missing VMs or action")
    credential = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
    compute_client = ComputeManagementClient(credential, subscription_id)
    # Run all VM actions in parallel
    async def operate_vm(vm):
        name = vm.get("name")
        resource_group = vm.get("resourceGroup")
        if not (name and resource_group):
            return {
                'name': name,
                'resourceGroup': resource_group,
                'location': '',
                'status': 'Error: Missing name or resource group',
            }
        try:
            loop = asyncio.get_event_loop()
            if action == "start":
                await loop.run_in_executor(None, lambda: compute_client.virtual_machines.begin_start(resource_group, name).wait())
            elif action == "deallocate":
                await loop.run_in_executor(None, lambda: compute_client.virtual_machines.begin_deallocate(resource_group, name).wait())
            elif action == "poweroff":
                await loop.run_in_executor(None, lambda: compute_client.virtual_machines.begin_power_off(resource_group, name).wait())
            elif action == "restart":
                await loop.run_in_executor(None, lambda: compute_client.virtual_machines.begin_restart(resource_group, name).wait())
            else:
                return {
                    'name': name,
                    'resourceGroup': resource_group,
                    'location': '',
                    'status': 'Error: Invalid action',
                }
            vm_obj = compute_client.virtual_machines.get(resource_group, name)
            instance_view = compute_client.virtual_machines.instance_view(resource_group, name)
            statuses = instance_view.statuses if hasattr(instance_view, 'statuses') else []
            status = next((s.display_status for s in statuses if s.code.startswith('PowerState')), 'Unknown')
            return {
                'name': vm_obj.name,
                'resourceGroup': resource_group,
                'location': vm_obj.location,
                'status': status,
            }
        except Exception as e:
            return {
                'name': name,
                'resourceGroup': resource_group,
                'location': '',
                'status': f'Error: {str(e)}',
            }
    results = await asyncio.gather(*(operate_vm(vm) for vm in vms))
    return results
