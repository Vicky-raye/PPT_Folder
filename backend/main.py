from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers.api import router as api_router

app = FastAPI(title="PPT Folder API")
# 允许常见 localhost 端口，避免前端端口变化导致 CORS 报错
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(api_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "PPT Folder API", "docs": "/docs"}
