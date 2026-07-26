import sys
import json
from app.core.config import settings
from app.core.observability import configure_logging, get_logger, log_step, instrument_module_functions

configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)

def main():
    if len(sys.argv) < 3:
        print("Usage: run_job.py <job_id> <file_id_1> [file_id_2 ...]", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[1]
    file_ids = sys.argv[2:]
    log_step(logger, "run_job.begin", job_id=job_id, file_count=len(file_ids))
    
    try:
        from app.services.analysis import generate_report_payload

        # Run the heavy CPU-bound analysis
        payload = generate_report_payload(file_ids, job_id)
        log_step(logger, "run_job.payload_ready", job_id=job_id)
        
        # Output payload strictly as JSON between marker lines
        print("___PAYLOAD_START___")
        if hasattr(payload, 'model_dump_json'):
            print(payload.model_dump_json())
        else:
            print(payload.json())
        print("___PAYLOAD_END___")
        sys.exit(0)
    except Exception as e:
        logger.exception("Job Failed")
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

instrument_module_functions(globals(), logger)
