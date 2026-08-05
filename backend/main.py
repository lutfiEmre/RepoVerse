"""RepoVerse FastAPI application."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:  # Supports both `uvicorn main:app` and `uvicorn backend.main:app`.
    from .ai_service import summarize_file
    from .parser import scan_repository
    from .web_scanner import scan_website
except ImportError:
    from ai_service import summarize_file
    from parser import scan_repository
    from web_scanner import scan_website


class ScanRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Local repository directory")


class SummaryRequest(BaseModel):
    root: str = Field(..., min_length=1)
    file_id: str = Field(..., min_length=1)
    functions: list[str] = Field(default_factory=list)
    classes: list[str] = Field(default_factory=list)


class WebsiteScanRequest(BaseModel):
    url: str = Field(..., min_length=8, description="Public website URL")
    max_pages: int = Field(default=8, ge=1, le=12)
    include_assets: bool = True


app = FastAPI(
    title="RepoVerse API",
    description="Local source repository scanner and Ollama-powered code explainer.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/scan")
async def scan(request: ScanRequest) -> dict:
    try:
        return scan_repository(request.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=422, detail=f"Could not read repository: {exc}") from exc


@app.post("/api/scan-url")
async def scan_url(request: WebsiteScanRequest) -> dict:
    try:
        return await scan_website(request.url, max_pages=request.max_pages, include_assets=request.include_assets)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=422, detail=f"Could not scan website: {exc}") from exc


@app.post("/api/summary")
async def summary(request: SummaryRequest) -> dict[str, str]:
    root = Path(request.root).expanduser().resolve()
    requested_file = (root / request.file_id).resolve()
    try:
        requested_file.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="File must be inside the scanned repository") from exc

    if not requested_file.exists() or not requested_file.is_file():
        raise HTTPException(status_code=404, detail="Source file not found")

    result = await summarize_file(
        requested_file,
        functions=request.functions,
        classes=request.classes,
    )
    return {"summary": result}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
