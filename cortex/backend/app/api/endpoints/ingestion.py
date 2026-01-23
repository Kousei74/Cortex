from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
import asyncio
# Import the OCR utility
from app.core.ocr import extract_text_from_image

router = APIRouter()

# In-memory storage for metadata (Prototype only)
# In a real app, this would be a database table (e.g., "uploads")
upload_sessions: Dict[str, dict] = {}

class MetaRequest(BaseModel):
    filename: str
    file_type: str
    file_size: int

class MetaResponse(BaseModel):
    id: str
    upload_url: str
    message: str

class IngestResponse(BaseModel):
    id: str
    filename: str
    status: str
    message: str
    ocr_result: Optional[str] = None

@router.post("/meta", response_model=MetaResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_session(meta: MetaRequest):
    """
    Step 1: Register metadata for a file upload.
    Returns an ID and a URL to upload the binary blob.
    """
    file_id = str(uuid.uuid4())
    upload_sessions[file_id] = {
        "filename": meta.filename,
        "file_type": meta.file_type,
        "file_size": meta.file_size,
        "status": "pending",
        "uploaded_at": None
    }
    
    return MetaResponse(
        id=file_id,
        upload_url=f"/ingest/blob/{file_id}",
        message="Metadata registered. Please upload binary to 'upload_url'."
    )

@router.put("/blob/{file_id}", response_model=IngestResponse)
async def upload_file_blob(file_id: str, request: Request):
    """
    Step 2: Stream the binary content for the registered file ID.
    Performs OCR if the file looks like an image.
    """
    if file_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    session = upload_sessions[file_id]
    
    try:
        # Read the raw binary body
        body = await request.body()
        
        # Verify size (optional safety check)
        if len(body) != session["file_size"]:
            # Warning: In real streaming, chunks might differ, but for this simple PUT, 
            # we expect the full body. We'll verify approximate size or just Log it.
            pass

        # Check for OCR candidacy
        ocr_text = None
        file_type = session["file_type"].lower()
        if "image" in file_type or file_type.endswith("pdf"):
            # Trigger OCR
            # Note: For PDF, logic in ocr.py might need adjustment if using easyocr strictly for images.
            # Assuming images for now based on EasyOCR plan.
            if "image" in file_type:
                 ocr_text = extract_text_from_image(body)

        # Update session status
        session["status"] = "completed"
        
        return IngestResponse(
            id=file_id,
            filename=session["filename"],
            status="processed",
            message="File uploaded and processed successfully.",
            ocr_result=ocr_text if ocr_text else "N/A"
        )
        
    except Exception as e:
        session["status"] = "failed"
        raise HTTPException(status_code=500, detail=f"Binary upload failed: {str(e)}")
