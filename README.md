# RepoVerse

RepoVerse is a local-first 3D map for exploring codebases and public website architecture.

I built it because a repository is much easier to understand when you can see the relationships instead of opening files one by one. The app turns source files, pages, assets and detected technologies into an interactive Three.js scene.

[emrelutfi.com](https://emrelutfi.com) · [GitHub](https://github.com/lutfiEmre)

## What it does

- Scans local Python, JavaScript and TypeScript repositories.
- Extracts Python functions, classes and imports with the standard-library AST.
- Resolves local JavaScript/TypeScript imports, including the common `@/*` alias.
- Crawls a limited number of same-origin pages when you switch to `Web` mode.
- Maps public pages, scripts, stylesheets, images and technology fingerprints.
- Uses local Ollama for short code summaries, with a static fallback when Ollama is offline.
- Presents everything as a 3D constellation with orbit controls, animated camera focus, a source index and a glass details panel.

## Stack

- Backend: Python, FastAPI, Pydantic, `ast`, HTTPX
- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- 3D: Three.js, React Three Fiber, Drei, GSAP
- Local AI: Ollama (`qwen2.5` by default)

## Run locally

### 1. Start the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Start the web app

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Using RepoVerse

### Repository mode

Choose `Repo` and enter an absolute local path, for example:

```text
/Users/your-name/Documents/my-project
```

The scanner skips common generated folders such as `node_modules`, `.next`, `dist`, `build`, `.git` and Python caches.

### Website mode

Choose `Web` and enter a public URL:

```text
https://example.com
```

The crawler stays on the same origin and returns a bounded graph of HTML pages, public assets and technology signals. It does not bypass authentication or try to infer private backend services from a URL alone.

## Ollama summaries

Ollama is optional. Without it, RepoVerse uses a local static summary instead.

```bash
ollama serve
ollama pull qwen2.5
```

You can override the defaults with `OLLAMA_MODEL`, `OLLAMA_URL` and `NEXT_PUBLIC_API_URL`.

## API

- `GET /api/health` — API health check
- `POST /api/scan` — scan a local repository with `{ "path": "..." }`
- `POST /api/scan-url` — crawl a website with `{ "url": "https://...", "max_pages": 8 }`
- `POST /api/summary` — request a local AI summary for a repository file

## Project layout

```text
repoverse/
├── backend/
│   ├── ai_service.py
│   ├── main.py
│   ├── parser.py
│   ├── web_scanner.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/
        ├── components/
        └── utils/
```

## Verification

```bash
python3 -m compileall -q backend
cd frontend
npm run typecheck
npm run build
```

## Author

Built by [Emre Lutfi](https://emrelutfi.com).

- Website: [emrelutfi.com](https://emrelutfi.com)
- GitHub: [github.com/lutfiEmre](https://github.com/lutfiEmre)
