from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
import os
from app.core.security import SessionUser, get_current_user
from app.core.config import settings
from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step

router = APIRouter()
logger = get_logger(__name__)

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


MAX_UPLOAD_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _upload_limit_message() -> str:
    return f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB upload limit."

@router.post("/meta", response_model=MetaResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_session(
    meta: MetaRequest,
    session_user: SessionUser = Depends(get_current_user),
):
    """
    Step 1: Register metadata for a file upload.
    Returns an ID and a URL to upload the binary blob.
    """
    log_step(
        logger,
        "ingest.meta.begin",
        filename=meta.filename,
        file_type=meta.file_type,
        file_size=meta.file_size,
        owner_emp_id=session_user.emp_id,
    )
    if meta.file_size <= 0:
        raise HTTPException(status_code=400, detail="File size must be greater than zero.")
    if meta.file_size > MAX_UPLOAD_SIZE_BYTES:
        log_step(logger, "ingest.meta.rejected_size", file_size=meta.file_size)
        raise HTTPException(status_code=413, detail=_upload_limit_message())

    file_id = str(uuid.uuid4())
    upload_sessions[file_id] = {
        "filename": meta.filename,
        "file_type": meta.file_type,
        "file_size": meta.file_size,
        "owner_emp_id": session_user.emp_id,
        "status": "pending",
        "uploaded_at": None
    }
    log_step(logger, "ingest.meta.session_created", file_id=file_id, owner_emp_id=session_user.emp_id)
    
    return MetaResponse(
        id=file_id,
        upload_url=f"/ingest/blob/{file_id}",
        message="Metadata registered. Please upload binary to 'upload_url'."
    )

@router.put("/blob/{file_id}", response_model=IngestResponse)
async def upload_file_blob(
    file_id: str,
    request: Request,
    session_user: SessionUser = Depends(get_current_user),
):
    """
    Step 2: Stream the binary content for the registered file ID and save it to disk.
    """
    log_step(logger, "ingest.blob.begin", file_id=file_id, owner_emp_id=session_user.emp_id)
    if file_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    session = upload_sessions[file_id]
    if session.get("owner_emp_id") != session_user.emp_id:
        raise HTTPException(status_code=403, detail="Upload session does not belong to you")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_UPLOAD_SIZE_BYTES:
                log_step(logger, "ingest.blob.rejected_content_length", file_id=file_id, content_length=content_length)
                raise HTTPException(status_code=413, detail=_upload_limit_message())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header.")

    upload_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    original_filename = os.path.basename(session["filename"])
    safe_filename = f"{file_id}_{original_filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    try:
        received_bytes = 0
        log_step(logger, "ingest.blob.stream_opened", file_id=file_id, file_path=file_path)

        with open(file_path, "wb") as f:
            async for chunk in request.stream():
                if not chunk:
                    continue

                received_bytes += len(chunk)
                if received_bytes > MAX_UPLOAD_SIZE_BYTES:
                    log_step(logger, "ingest.blob.rejected_stream_size", file_id=file_id, received_bytes=received_bytes)
                    raise HTTPException(status_code=413, detail=_upload_limit_message())

                f.write(chunk)

        if received_bytes != session["file_size"]:
            log_step(
                logger,
                "ingest.blob.size_mismatch",
                file_id=file_id,
                received_bytes=received_bytes,
                expected_bytes=session["file_size"],
            )
            raise HTTPException(
                status_code=400,
                detail="Uploaded size did not match the registered file size."
            )

        session["file_path"] = file_path

        # Update session status
        session["status"] = "completed"
        log_step(logger, "ingest.blob.completed", file_id=file_id, received_bytes=received_bytes)
        
        return IngestResponse(
            id=file_id,
            filename=session["filename"],
            status="processed",
            message="File uploaded and processed successfully."
        )

    except HTTPException:
        session["status"] = "failed"
        if os.path.exists(file_path):
            os.remove(file_path)
        log_step(logger, "ingest.blob.failed_http", file_id=file_id, status=session["status"])
        raise
    except Exception as e:
        session["status"] = "failed"
        if os.path.exists(file_path):
            os.remove(file_path)
        log_step(logger, "ingest.blob.failed_exception", file_id=file_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Binary upload failed: {str(e)}")


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions", "instrument_fastapi_router"})
instrument_fastapi_router(router, logger)
