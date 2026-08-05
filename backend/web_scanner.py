"""Small, dependency-light website architecture crawler.

This module intentionally crawls only same-origin HTML pages and records the
public signals visible in their HTML, headers, scripts and stylesheets. It is
not a security scanner and it does not bypass authentication or robots rules.
"""

from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse, urlunparse

import httpx


MAX_HTML_BYTES = 1_500_000
DEFAULT_MAX_PAGES = 8
USER_AGENT = "RepoVerse/0.2 local architecture crawler"


def _canonical_url(value: str) -> str:
    value, _ = urldefrag(value)
    parsed = urlparse(value)
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/") or "/"
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), path, "", parsed.query, ""))


def _same_origin(left: str, right: str) -> bool:
    left_parts = urlparse(left)
    right_parts = urlparse(right)
    return (left_parts.scheme, left_parts.netloc) == (right_parts.scheme, right_parts.netloc)


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _looks_like_page(value: str) -> bool:
    path = urlparse(value).path.lower()
    return not bool(re.search(r"\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|pdf|zip|mp4|webm)$", path))


def _path_label(value: str) -> str:
    parsed = urlparse(value)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    return path


def _asset_type(value: str, tag: str) -> str:
    if tag == "script":
        return "script"
    if tag == "link":
        return "stylesheet"
    if tag == "img":
        return "image"
    return "external"


class _DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.links: list[str] = []
        self.assets: list[tuple[str, str]] = []
        self._inside_title = False
        self._title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        tag = tag.lower()
        if tag == "title":
            self._inside_title = True
        if tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"] or "")
        if tag == "script" and attributes.get("src"):
            self.assets.append((attributes["src"] or "", "script"))
        if tag == "link" and attributes.get("href"):
            rel = (attributes.get("rel") or "").lower()
            if "stylesheet" in rel or attributes.get("as") in {"script", "style"}:
                self.assets.append((attributes["href"] or "", "link"))
        if tag in {"img", "iframe", "video", "source"} and attributes.get("src"):
            self.assets.append((attributes["src"] or "", tag))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._inside_title = False
            self.title = "".join(self._title_parts).strip()

    def handle_data(self, data: str) -> None:
        if self._inside_title:
            self._title_parts.append(data)


@dataclass
class _PageRecord:
    url: str
    status: int
    title: str
    content_type: str
    size_bytes: int
    links: list[str] = field(default_factory=list)
    assets: list[tuple[str, str]] = field(default_factory=list)


def _detect_technologies(html: str, headers: httpx.Headers) -> list[tuple[str, str]]:
    haystack = f"{html}\n{headers}".lower()
    fingerprints: list[tuple[str, tuple[str, ...], str]] = [
        ("Next.js", ("/_next/", "__next_data__", "next/router"), "Next.js runtime or build asset detected."),
        ("React", ("react", "data-reactroot", "__react_devtools_global_hook__"), "React runtime signal detected."),
        ("Vue", ("data-v-", "vue.runtime", "vue.js"), "Vue runtime signal detected."),
        ("Nuxt", ("__nuxt__", "/_nuxt/"), "Nuxt application signal detected."),
        ("Angular", ("ng-version", "angular"), "Angular runtime signal detected."),
        ("WordPress", ("/wp-content/", "wordpress"), "WordPress public asset or generator signal detected."),
        ("Shopify", ("cdn.shopify.com", "shopify"), "Shopify public asset signal detected."),
        ("Tailwind CSS", ("tailwind", "--tw-"), "Tailwind CSS utility signal detected."),
        ("Vite", ("@vite/client", "/@vite/"), "Vite development/build signal detected."),
        ("Google Analytics", ("googletagmanager.com", "gtag(", "google-analytics.com"), "Google Analytics signal detected."),
        ("Stripe", ("js.stripe.com", "stripe"), "Stripe integration signal detected."),
    ]
    detected: list[tuple[str, str]] = []
    for name, signals, description in fingerprints:
        if any(signal in haystack for signal in signals):
            detected.append((name, description))

    server = headers.get("server", "").strip()
    if server:
        detected.append((f"Server: {server}", "Server header exposed by the origin response."))
    return detected


def _node(
    node_id: str,
    label: str,
    node_type: str,
    *,
    size: int = 6,
    size_bytes: int = 0,
    description: str = "",
    url: str | None = None,
    status: int | None = None,
) -> dict:
    return {
        "id": node_id,
        "label": label,
        "size": size,
        "type": node_type,
        "size_bytes": size_bytes,
        "functions": [],
        "classes": [],
        "imports": [],
        "description": description,
        "url": url,
        "status": status,
    }


async def scan_website(url: str, max_pages: int = DEFAULT_MAX_PAGES, include_assets: bool = True) -> dict:
    """Crawl a public same-origin website and return graph-ready data."""

    if not _is_http_url(url):
        raise ValueError("Website URL must start with http:// or https://")

    start_url = _canonical_url(url)
    origin = urlparse(start_url).netloc
    site_id = f"site://{origin}"
    queue: deque[str] = deque([start_url])
    queued = {start_url}
    records: list[_PageRecord] = []
    asset_map: dict[str, str] = {}
    technologies: dict[str, str] = {}
    warnings: list[str] = []

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(10.0, connect=5.0),
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        while queue and len(records) < max(1, min(max_pages, 12)):
            current_url = queue.popleft()
            try:
                response = await client.get(current_url)
            except httpx.HTTPError as exc:
                if not records:
                    raise ValueError(f"Website could not be fetched: {exc}") from exc
                warnings.append(f"Could not fetch {current_url}: {exc}")
                continue

            content_type = response.headers.get("content-type", "").lower()
            body = response.content[:MAX_HTML_BYTES]
            if "html" not in content_type and current_url == start_url:
                raise ValueError(f"URL did not return HTML (content-type: {content_type or 'unknown'})")
            if "html" not in content_type:
                continue

            parser = _DocumentParser()
            parser.feed(body.decode(response.encoding or "utf-8", errors="ignore"))
            final_url = _canonical_url(str(response.url))
            record = _PageRecord(
                url=final_url,
                status=response.status_code,
                title=parser.title or _path_label(final_url),
                content_type=content_type,
                size_bytes=len(response.content),
            )
            record.links = [
                _canonical_url(urljoin(final_url, href))
                for href in parser.links
                if href and _is_http_url(urljoin(final_url, href))
            ]
            record.assets = [
                (_canonical_url(urljoin(final_url, asset_url)), tag)
                for asset_url, tag in parser.assets
                if asset_url and _is_http_url(urljoin(final_url, asset_url))
            ]
            records.append(record)

            for name, description in _detect_technologies(body.decode("utf-8", errors="ignore"), response.headers):
                technologies[name] = description

            if include_assets:
                for asset_url, tag in record.assets:
                    if _same_origin(asset_url, start_url):
                        asset_map[asset_url] = _asset_type(asset_url, tag)

            for link in record.links:
                if _same_origin(link, start_url) and _looks_like_page(link) and link not in queued:
                    queued.add(link)
                    queue.append(link)

    if len(records) >= max_pages and queue:
        warnings.append(f"Crawl capped at {max_pages} pages.")

    nodes: list[dict] = [
        _node(
            site_id,
            origin,
            "website",
            size=18,
            description="Website root. Same-origin pages, public assets and detected technology signals branch from this node.",
            url=start_url,
        )
    ]
    edges: list[dict[str, str]] = []
    page_ids = {record.url: f"page:{record.url}" for record in records}

    for record in records:
        page_id = page_ids[record.url]
        nodes.append(
            _node(
                page_id,
                _path_label(record.url),
                "page",
                size=max(6, min(20, 6 + len(record.links) * 2)),
                size_bytes=record.size_bytes,
                description=f"HTTP {record.status} · {record.title} · {len(record.links)} internal links · {len(record.assets)} referenced assets.",
                url=record.url,
                status=record.status,
            )
        )
        edges.append({"source": site_id, "target": page_id})

        for link in record.links:
            target_id = page_ids.get(link)
            if target_id and target_id != page_id:
                edge = {"source": page_id, "target": target_id}
                if edge not in edges:
                    edges.append(edge)

        if include_assets:
            for asset_url in {asset_url for asset_url, _ in record.assets if asset_url in asset_map}:
                asset_id = f"asset:{asset_url}"
                if not any(node["id"] == asset_id for node in nodes):
                    nodes.append(
                        _node(
                            asset_id,
                            _path_label(asset_url),
                            asset_map[asset_url],
                            size=4,
                            description=f"Public {asset_map[asset_url]} referenced by {_path_label(record.url)}.",
                            url=asset_url,
                        )
                    )
                edges.append({"source": page_id, "target": asset_id})

    for name, description in technologies.items():
        technology_id = f"technology:{name.lower().replace(' ', '-').replace(':', '-')}"
        nodes.append(_node(technology_id, name, "technology", size=8, description=description))
        edges.append({"source": site_id, "target": technology_id})

    return {
        "root": start_url,
        "mode": "website",
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "technologies": list(technologies),
            "pages": len(records),
            "assets": len(asset_map),
            "warnings": warnings,
            "crawled_at": datetime.now(timezone.utc).isoformat(),
        },
    }
