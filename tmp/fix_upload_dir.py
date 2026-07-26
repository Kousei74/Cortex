from pathlib import Path

config_path = Path(r'cortex/backend/app/core/config.py')
config_text = config_path.read_text()
if 'UPLOAD_DIR: str = "/tmp/cortex-uploads"' not in config_text:
    config_text = config_text.replace(
        '    SMTP_FROM_NAME: str = "Cortex"\n',
        '    SMTP_FROM_NAME: str = "Cortex"\n    UPLOAD_DIR: str = "/tmp/cortex-uploads"\n'
    )
config_path.write_text(config_text)

ingestion_path = Path(r'cortex/backend/app/api/endpoints/ingestion.py')
ingestion_text = ingestion_path.read_text()
ingestion_text = ingestion_text.replace(
    '    upload_dir = os.path.join(os.getcwd(), "uploads")\n',
    '    upload_dir = settings.UPLOAD_DIR\n'
)
ingestion_path.write_text(ingestion_text)

analysis_path = Path(r'cortex/backend/app/services/analysis.py')
analysis_text = analysis_path.read_text()
analysis_text = analysis_text.replace(
    '             os.makedirs("uploads", exist_ok=True)\n             with open(f"uploads/{job_id}_resolution.json", \'w\') as f:\n',
    '             os.makedirs(settings.UPLOAD_DIR, exist_ok=True)\n             resolution_path = os.path.join(settings.UPLOAD_DIR, f"{job_id}_resolution.json")\n             with open(resolution_path, \'w\') as f:\n'
)
analysis_path.write_text(analysis_text)

env_path = Path(r'cortex/backend/.env.example')
env_text = env_path.read_text()
if 'UPLOAD_DIR=/tmp/cortex-uploads' not in env_text:
    env_text = env_text.replace(
        'SMTP_FROM_NAME=Cortex\n',
        'SMTP_FROM_NAME=Cortex\nUPLOAD_DIR=/tmp/cortex-uploads\n'
    )
env_path.write_text(env_text)
