from pathlib import Path

# jobs.py
path = Path(r'cortex/backend/app/services/jobs.py')
text = path.read_text()
text = text.replace(
    'class Job:\n    def __init__(self, job_id: str, file_ids: List[str], project_id: str, owner_emp_id: str):\n        self.job_id = job_id\n        self.file_ids = file_ids\n',
    'class Job:\n    def __init__(self, job_id: str, file_ids: List[str], file_paths: List[str], project_id: str, owner_emp_id: str):\n        self.job_id = job_id\n        self.file_ids = file_ids\n        self.file_paths = file_paths\n'
)
text = text.replace(
    '    def create_job(file_ids: List[str], project_id: str, owner_emp_id: str) -> tuple[str, bool]:\n',
    '    def create_job(file_ids: List[str], file_paths: List[str], project_id: str, owner_emp_id: str) -> tuple[str, bool]:\n'
)
text = text.replace(
    '        new_job = Job(job_id, file_ids, project_id, owner_emp_id)\n',
    '        new_job = Job(job_id, file_ids, file_paths, project_id, owner_emp_id)\n'
)
path.write_text(text)

# reports.py
path = Path(r'cortex/backend/app/api/endpoints/reports.py')
text = path.read_text()
if 'import os\n\nfrom fastapi import APIRouter' not in text:
    text = text.replace('from fastapi import APIRouter, HTTPException, status, Depends\n', 'import os\n\nfrom fastapi import APIRouter, HTTPException, status, Depends\n')
if 'from app.api.endpoints.ingestion import upload_sessions\n' not in text:
    text = text.replace('from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step\n', 'from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step\nfrom app.api.endpoints.ingestion import upload_sessions\n')
needle = '    if JobManager.count_pending_jobs() >= settings.MAX_PENDING_JOBS:\n        log_step(logger, "reports.create.rejected_queue_limit", pending=JobManager.count_pending_jobs())\n        raise HTTPException(\n            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,\n            detail="Report queue is full right now. Please try again in a moment."\n        )\n\n'
insert = needle + '    file_paths = []\n    missing_file_ids = []\n    for file_id in request.file_ids:\n        session = upload_sessions.get(file_id)\n        file_path = session.get("file_path") if session else None\n        if not session or session.get("owner_emp_id") != session_user.emp_id or session.get("status") != "completed" or not file_path or not os.path.exists(file_path):\n            missing_file_ids.append(file_id)\n            continue\n        file_paths.append(file_path)\n\n    if missing_file_ids:\n        log_step(logger, "reports.create.rejected_missing_uploads", owner_emp_id=session_user.emp_id, missing_count=len(missing_file_ids))\n        raise HTTPException(\n            status_code=status.HTTP_400_BAD_REQUEST,\n            detail="One or more uploaded files are no longer available. Please re-upload and try again."\n        )\n\n'
if 'missing_file_ids' not in text:
    text = text.replace(needle, insert)
text = text.replace(
    '    job_id, is_existing = JobManager.create_job(request.file_ids, request.project_id, session_user.emp_id)\n',
    '    job_id, is_existing = JobManager.create_job(request.file_ids, file_paths, request.project_id, session_user.emp_id)\n'
)
path.write_text(text)

# worker.py
path = Path(r'cortex/backend/app/worker.py')
text = path.read_text()
text = text.replace(
    '                    "python", "-m", "app.run_job", job_id, *job.file_ids,\n',
    '                    "python", "-m", "app.run_job", job_id, *job.file_paths,\n'
)
text = text.replace(
    '                log_step(logger, "worker.subprocess.started", job_id=job_id, file_count=len(job.file_ids))\n',
    '                log_step(logger, "worker.subprocess.started", job_id=job_id, file_count=len(job.file_paths))\n'
)
path.write_text(text)

# run_job.py
path = Path(r'cortex/backend/app/run_job.py')
text = path.read_text()
text = text.replace(
    '        print("Usage: run_job.py <job_id> <file_id_1> [file_id_2 ...]", file=sys.stderr)\n',
    '        print("Usage: run_job.py <job_id> <file_path_1> [file_path_2 ...]", file=sys.stderr)\n'
)
text = text.replace(
    '    file_ids = sys.argv[2:]\n    log_step(logger, "run_job.begin", job_id=job_id, file_count=len(file_ids))\n',
    '    file_paths = sys.argv[2:]\n    log_step(logger, "run_job.begin", job_id=job_id, file_count=len(file_paths))\n'
)
text = text.replace(
    '        payload = generate_report_payload(file_ids, job_id)\n',
    '        payload = generate_report_payload(file_paths, job_id)\n'
)
path.write_text(text)

# analysis.py
path = Path(r'cortex/backend/app/services/analysis.py')
text = path.read_text()
text = text.replace(
    'def generate_report_payload(file_ids: List[str], job_id: str = None) -> ReportPayload:\n',
    'def generate_report_payload(file_paths: List[str], job_id: str = None) -> ReportPayload:\n'
)
old = "    dfs = []\n    from app.api.endpoints.ingestion import upload_sessions\n    for fid in file_ids:\n        if fid in upload_sessions:\n            path = upload_sessions[fid].get('file_path')\n            if path and os.path.exists(path):\n                try:\n                    dfs.append(load_dataset(path))\n                except Exception as e:\n                    logger.error(f\"Failed to load {fid}: {e}\")\n"
new = "    dfs = []\n    for path in file_paths:\n        if path and os.path.exists(path):\n            try:\n                dfs.append(load_dataset(path))\n            except Exception as e:\n                logger.error(f\"Failed to load {path}: {e}\")\n"
text = text.replace(old, new)
path.write_text(text)
