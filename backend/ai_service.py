"""Local Ollama integration with a deterministic offline fallback."""

from __future__ import annotations

import os
from pathlib import Path

import httpx


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5")


def _fallback_summary(file_path: Path, functions: list[str], classes: list[str]) -> str:
    """Return useful copy even when Ollama is not running."""

    language = {
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".tsx": "TSX",
    }.get(file_path.suffix, "Kaynak")
    symbols = len(functions) + len(classes)
    details = []
    if classes:
        details.append(f"{len(classes)} sınıf")
    if functions:
        details.append(f"{len(functions)} fonksiyon")
    detail_text = ", ".join(details) if details else "belirgin bir sembol"
    return (
        f"Bu {language} dosyası, proje içindeki uygulama akışına katkı sağlayan {detail_text} içerir. "
        "Ollama yerel olarak çalışmadığı için bu özet statik kaynak analiziyle üretildi."
    )


async def summarize_file(
    file_path: str | Path,
    *,
    functions: list[str] | None = None,
    classes: list[str] | None = None,
) -> str:
    """Ask a local Ollama model for a concise two-sentence code summary."""

    path = Path(file_path)
    functions = functions or []
    classes = classes or []
    fallback = _fallback_summary(path, functions, classes)

    try:
        source = path.read_text(encoding="utf-8", errors="ignore")
        # Keep requests responsive for large repositories/files.
        source = source[:14000]
        prompt = (
            "You are a senior software engineer. Summarize the following source file in exactly "
            "two concise Turkish sentences. Mention its primary responsibility and the most "
            "important symbols or integrations. Do not use markdown.\n\n"
            f"FILE: {path.name}\n{source}"
        )
        async with httpx.AsyncClient(timeout=18.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            generated = response.json().get("response", "").strip()
            if generated:
                return generated
    except (OSError, httpx.HTTPError, ValueError, KeyError):
        pass

    return fallback
