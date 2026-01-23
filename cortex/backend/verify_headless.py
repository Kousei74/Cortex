import httpx
import asyncio
import os

# Configuration
BASE_URL = "http://localhost:8000"
EMAIL = "verify_headless@test.com"
PASSWORD = "password123"
FILENAME = "test_ocr.txt"
CONTENT = b"This is a test file for headless ingestion."

async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        print(f"--- 1. Authenticating ({EMAIL}) ---")
        # 1. Signup (ignore error if exists)
        try:
            await client.post("/auth/signup", json={
                "email": EMAIL,
                "password": PASSWORD,
                "full_name": "Headless Tester"
            })
            print("Signup successful.")
        except:
            print("User might already exist, proceeding to login.")

        # 2. Login
        login_res = await client.post("/auth/login", data={
            "username": EMAIL,
            "password": PASSWORD
        })
        if login_res.status_code != 200:
            print(f"Login Failed: {login_res.text}")
            return
        
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login successful. Token acquired.")

        # 3. Step 1: POST /ingest/meta
        print("\n--- 2. Registering Metadata (POST /ingest/meta) ---")
        meta_payload = {
            "filename": FILENAME,
            "file_type": "text/plain",
            "file_size": len(CONTENT)
        }
        meta_res = await client.post("/ingest/meta", json=meta_payload, headers=headers)
        
        if meta_res.status_code != 201:
            print(f"Meta Registration Failed: {meta_res.text}")
            return
            
        meta_data = meta_res.json()
        file_id = meta_data["id"]
        upload_url = meta_data["upload_url"] # Relative URL
        print(f"Metadata Registered. File ID: {file_id}")
        print(f"Upload URL: {upload_url}")

        # 4. Step 2: PUT /ingest/blob/{id}
        print(f"\n--- 3. Uploading Blob (PUT {upload_url}) ---")
        # Note: We append upload_url to base, but upload_url comes as relative path from backend
        # We need to ensure we don't double slash if using client.put(upload_url)
        
        blob_res = await client.put(upload_url, content=CONTENT, headers=headers)
        
        if blob_res.status_code != 200:
            print(f"Blob Upload Failed: {blob_res.text}")
            return
            
        blob_data = blob_res.json()
        print("Blob Upload Successful!")
        print(f"Response: {blob_data}")
        
        if blob_data["status"] == "processed":
            print("\n✅ SUCCESS: Headless Ingestion Flow Verified.")
        else:
            print("\n⚠️ WARNING: flow finished but status is not processed.")

if __name__ == "__main__":
    asyncio.run(main())
