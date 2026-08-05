"""Repository parsing utilities for RepoVerse.

Python files are parsed with the standard-library AST. JavaScript and
TypeScript files use deliberately conservative regular expressions because
the backend must stay zero-budget and dependency-light.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


SUPPORTED_EXTENSIONS = {".py", ".js", ".ts", ".tsx"}
SKIPPED_DIRECTORIES = {
    ".git",
    ".hg",
    ".next",
    ".svn",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "venv",
    ".venv",
}


@dataclass
class ParsedFile:
    """The metadata needed by both the graph and the details sidebar."""

    path: Path
    relative_id: str
    language: str
    functions: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    size_bytes: int = 0

    @property
    def symbol_count(self) -> int:
        return len(self.functions) + len(self.classes)

    @property
    def visual_size(self) -> int:
        """Return a bounded node radius driver for the 3D graph."""

        complexity = self.symbol_count * 2 + len(self.imports)
        return max(4, min(28, 4 + complexity))


def _language_for(path: Path) -> str:
    if path.suffix == ".py":
        return "python"
    if path.suffix == ".tsx":
        return "tsx"
    if path.suffix == ".ts":
        return "typescript"
    return "javascript"


def _relative_id(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _unique(items: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(item for item in items if item))


def _parse_python(source: str) -> tuple[list[str], list[str], list[str]]:
    functions: list[str] = []
    classes: list[str] = []
    imports: list[str] = []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        # A half-written file should not make the whole repository fail.
        return functions, classes, imports

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(node.name)
        elif isinstance(node, ast.ClassDef):
            classes.append(node.name)
        elif isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            prefix = "." * node.level
            module = node.module or ""
            imports.append(f"{prefix}{module}" if module else prefix)

    return _unique(functions), _unique(classes), _unique(imports)


JS_IMPORT_PATTERNS = (
    re.compile(r"\bimport\s+(?:[\s\S]*?\s+from\s+)?['\"]([^'\"]+)['\"]"),
    re.compile(r"\bexport\s+[\s\S]*?\s+from\s+['\"]([^'\"]+)['\"]"),
    re.compile(r"\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)"),
    re.compile(r"\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)"),
)
JS_FUNCTION_PATTERN = re.compile(
    r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|"
    r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"
)
JS_CLASS_PATTERN = re.compile(r"\bclass\s+([A-Za-z_$][\w$]*)")


def _parse_javascript(source: str) -> tuple[list[str], list[str], list[str]]:
    imports: list[str] = []
    for pattern in JS_IMPORT_PATTERNS:
        imports.extend(pattern.findall(source))

    functions: list[str] = []
    for match in JS_FUNCTION_PATTERN.finditer(source):
        functions.append(match.group(1) or match.group(2))

    classes = JS_CLASS_PATTERN.findall(source)
    return _unique(functions), _unique(classes), _unique(imports)


def _parse_file(path: Path, root: Path) -> ParsedFile:
    source = path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix == ".py":
        functions, classes, imports = _parse_python(source)
    else:
        functions, classes, imports = _parse_javascript(source)

    return ParsedFile(
        path=path,
        relative_id=_relative_id(path, root),
        language=_language_for(path),
        functions=functions,
        classes=classes,
        imports=imports,
        size_bytes=path.stat().st_size,
    )


def _iter_source_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in SUPPORTED_EXTENSIONS:
            continue
        if any(part in SKIPPED_DIRECTORIES or part.startswith(".") for part in path.relative_to(root).parts):
            continue
        yield path


def _strip_python_import(import_name: str) -> str:
    return import_name.lstrip(".")


def _resolve_import(source: ParsedFile, imported: str, known_ids: set[str]) -> str | None:
    """Resolve an import to a graph node when it points inside the repo."""

    if not imported:
        return None

    source_dir = Path(source.relative_id).parent
    candidates: list[Path] = []

    if source.language == "python":
        if imported.startswith("."):
            dots = len(imported) - len(imported.lstrip("."))
            base = source_dir
            for _ in range(max(0, dots - 1)):
                base = base.parent
            module = _strip_python_import(imported).replace(".", "/")
            candidates.extend([base / module, base / f"{module}.py", base / module / "__init__.py"])
        else:
            module = imported.replace(".", "/")
            candidates.extend(
                [
                    source_dir / f"{module}.py",
                    source_dir / module / "__init__.py",
                    Path(f"{module}.py"),
                    Path(module) / "__init__.py",
                ]
            )
    elif imported.startswith("@/"):
        # Resolve the common Next.js `@/*` alias relative to the nearest src
        # directory, so frontend imports become meaningful graph edges.
        source_parts = Path(source.relative_id).parts
        if "src" in source_parts:
            src_index = source_parts.index("src")
            src_root = Path(*source_parts[: src_index + 1])
            base = src_root / imported[2:]
        else:
            base = Path(imported[2:])
        candidates.extend(
            [
                base,
                *[Path(f"{base}{extension}") for extension in (".js", ".ts", ".tsx")],
                *[base / f"index{extension}" for extension in (".js", ".ts", ".tsx")],
            ]
        )
    elif imported.startswith("."):
        base = source_dir / imported
        candidates.extend(
            [
                base,
                *[Path(f"{base}{extension}") for extension in (".js", ".ts", ".tsx")],
                *[base / f"index{extension}" for extension in (".js", ".ts", ".tsx")],
            ]
        )
    else:
        # Bare JavaScript packages and external Python packages are outside the
        # visualized repository and therefore do not become graph edges.
        return None

    for candidate in candidates:
        candidate_id = candidate.as_posix()
        if candidate_id in known_ids:
            return candidate_id
    return None


def scan_repository(directory: str | Path) -> dict:
    """Scan a repository and return graph-ready JSON-compatible data."""

    root = Path(directory).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"Scan directory does not exist: {root}")

    parsed_files = [_parse_file(path, root) for path in _iter_source_files(root)]
    parsed_files.sort(key=lambda item: item.relative_id)
    known_ids = {item.relative_id for item in parsed_files}

    nodes = [
        {
            "id": item.relative_id,
            "label": item.relative_id,
            "size": item.visual_size,
            "type": item.language,
            "size_bytes": item.size_bytes,
            "functions": item.functions,
            "classes": item.classes,
            "imports": item.imports,
        }
        for item in parsed_files
    ]

    edges: list[dict[str, str]] = []
    for item in parsed_files:
        for imported in item.imports:
            target = _resolve_import(item, imported, known_ids)
            if target and target != item.relative_id:
                edge = {"source": item.relative_id, "target": target}
                if edge not in edges:
                    edges.append(edge)

    return {"root": str(root), "mode": "repository", "nodes": nodes, "edges": edges}
