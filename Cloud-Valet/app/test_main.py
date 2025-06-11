import pytest
import httpx
import os
import json

BASE_URL = "http://localhost:8000"

def get_admin_cookies():
    # This assumes admin login is possible via /login
    with httpx.Client(base_url="http://127.0.0.1:8000") as c:
        resp = c.post("/login", data={"username": "admin", "password": "admin123"})
        cookies = dict(resp.cookies)
    return cookies

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

def test_provider_get_no_secret():
    cookies = get_admin_cookies()
    r = httpx.get("http://127.0.0.1:8000/provider/azure", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert "clientSecret" not in data
    assert "clientId" in data and "tenantId" in data

def test_provider_post_and_last_updated():
    cookies = get_admin_cookies()
    payload = {
        "client_id": "test-client-id",
        "tenant_id": "test-tenant-id",
        "client_secret": "test-secret"
    }
    r = httpx.post("http://127.0.0.1:8000/provider/azure", data=payload, cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "last_updated" in data
    # Now GET should return last_updated and not clientSecret
    r2 = httpx.get("http://127.0.0.1:8000/provider/azure", cookies=cookies)
    data2 = r2.json()
    assert "last_updated" in data2
    assert data2["clientId"] == "test-client-id"
    assert data2["tenantId"] == "test-tenant-id"
    assert "clientSecret" not in data2

def test_provider_admin_only():
    # No cookie
    r = httpx.get("http://127.0.0.1:8000/provider/azure")
    assert r.status_code == 403 or r.status_code == 401
    # Non-admin user
    # Create user if needed
    with httpx.Client(base_url="http://127.0.0.1:8000") as c:
        c.post("/users/", data={"username": "testuser", "email": "t@t.com", "password": "pw", "permission": "Read"})
        resp = c.post("/login", data={"username": "testuser", "password": "pw"})
        cookies = dict(resp.cookies)
        r2 = c.get("/provider/azure", cookies=cookies)
        assert r2.status_code == 403
