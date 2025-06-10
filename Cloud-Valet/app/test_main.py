import pytest
import httpx

BASE_URL = "http://localhost:8000"

@pytest.mark.asyncio
async def test_root():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        r = await ac.get("/")
        assert r.status_code == 200
        assert r.json()["message"].startswith("Cloud Valet")

@pytest.mark.asyncio
async def test_admin_user_exists():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        r = await ac.get("/users/")
        assert r.status_code == 200
        assert any(u["username"] == "admin" for u in r.json())

@pytest.mark.asyncio
async def test_create_user_and_login_logout():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Ensure testuser does not exist
        await ac.delete("/users/testuser")
        # Create user
        r = await ac.post("/users/", data={"username": "testuser", "email": "test@x.com", "password": "pw", "permission": "Write"})
        assert r.status_code == 200
        # Login
        r = await ac.post("/login", data={"username": "testuser", "password": "pw"}, follow_redirects=False)
        assert r.status_code in (302, 307)
        cookie = r.cookies.get("user")
        assert cookie == "testuser"
        # Authenticated /users/me
        r = await ac.get("/users/me", cookies={"user": cookie})
        assert r.status_code == 200
        assert r.json()["username"] == "testuser"
        assert r.json()["permission"] == "Write"
        # Logout
        r = await ac.get("/logout", cookies={"user": cookie}, follow_redirects=False)
        assert r.status_code in (302, 307)

@pytest.mark.asyncio
async def test_permission_access():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Login as admin
        r = await ac.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=False)
        cookie = r.cookies.get("user")
        # Admin can see all users
        r = await ac.get("/users/", cookies={"user": cookie})
        assert r.status_code == 200
        # Admin permission
        r = await ac.get("/users/me", cookies={"user": cookie})
        assert r.status_code == 200
        assert r.json()["permission"] == "Admin"
        # Nonexistent user
        r = await ac.get("/users/me", cookies={"user": "nouser"})
        assert r.status_code == 404

@pytest.mark.asyncio
async def test_update_and_delete_user():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Create user
        r = await ac.post("/users/", data={"username": "deluser", "email": "del@x.com", "password": "pw", "permission": "Read"})
        assert r.status_code == 200
        # Update user
        r = await ac.put("/users/deluser", data={"new_username": "deluser2", "email": "del2@x.com", "permission": "Write"})
        assert r.status_code == 200
        assert r.json()["username"] == "deluser2"
        assert r.json()["permission"] == "Write"
        # Delete user
        r = await ac.delete("/users/deluser2")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Confirm deleted
        r = await ac.get("/users/deluser2")
        assert r.status_code == 404

@pytest.mark.asyncio
async def test_group_crud():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Login as admin
        r = await ac.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=False)
        cookie = r.cookies.get("user")
        # Ensure testgroup does not exist
        await ac.delete("/groups/testgroup", cookies={"user": cookie})
        # Create group
        r = await ac.post("/groups/", params={"name": "testgroup"}, cookies={"user": cookie})
        if r.status_code != 200:
            print("/groups/ create failed:", r.status_code, r.text, r.content)
        assert r.status_code == 200
        # List groups
        r = await ac.get("/groups/", cookies={"user": cookie})
        assert r.status_code == 200
        assert any(g["name"] == "testgroup" for g in r.json())

@pytest.mark.asyncio
async def test_tag_crud():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Login as admin
        r = await ac.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=False)
        cookie = r.cookies.get("user")
        # Ensure testtag does not exist
        await ac.delete("/tags/testtag", cookies={"user": cookie})
        # Create tag
        r = await ac.post("/tags/", params={"name": "testtag"}, cookies={"user": cookie})
        if r.status_code != 200:
            print("/tags/ create failed:", r.status_code, r.text, r.content)
        assert r.status_code == 200
        # List tags
        r = await ac.get("/tags/", cookies={"user": cookie})
        assert r.status_code == 200
        assert any(t["name"] == "testtag" for t in r.json())

@pytest.mark.asyncio
async def test_vm_crud():
    async with httpx.AsyncClient(base_url=BASE_URL) as ac:
        # Login as admin
        r = await ac.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=False)
        cookie = r.cookies.get("user")
        # Ensure testvm does not exist
        await ac.delete("/vms/testvm", cookies={"user": cookie})
        # Create VM
        r = await ac.post("/vms/", params={"name": "testvm"}, cookies={"user": cookie})
        if r.status_code != 200:
            print("/vms/ create failed:", r.status_code, r.text, r.content)
        assert r.status_code == 200
        # List VMs
        r = await ac.get("/vms/", cookies={"user": cookie})
        assert r.status_code == 200
        assert any(v["name"] == "testvm" for v in r.json())
