import os
from pathlib import Path

# 从 backend 目录加载 .env（否则 uvicorn 启动时读不到）
_env_dir = Path(__file__).resolve().parent.parent
_env_file = _env_dir / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()

DATA_DIR = Path(_env("DATA_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "app.db"

ARK_API_KEY = _env("ARK_API_KEY")
ARK_MODEL_ID = _env("ARK_MODEL_ID", "doubao-seed-2.0-lite-260215")
ARK_BASE_URL = _env("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")

UPLOAD_MAX_MB = int(_env("UPLOAD_MAX_MB", "50"))
