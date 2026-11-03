# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "lxml", "markdownify"]
# ///
"""Полный снимок сайта nsp-center.ru: обход страниц, сырой HTML, структура, ассеты.

Запуск (из каталога этого файла):
    uv run scrape.py            # crawl -> assets -> extract
    uv run scrape.py extract    # только пересобрать data/ и md/ из уже скачанного raw/
    uv run scrape.py --refetch  # скачать страницы заново, игнорируя кэш raw/

Этапы:
    crawl   — BFS по внутренним ссылкам с корня и sitemap; raw/<путь>.html.gz
    assets  — изображения (оригиналы вместо resize_cache), CSS, JS, шрифты, документы
    extract — data/*.json(l), data/products.csv, md/<путь>.md
"""
from __future__ import annotations

import collections
import csv
import gzip
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from markdownify import markdownify

BASE = "https://nsp-center.ru"
HOSTS = {"nsp-center.ru", "www.nsp-center.ru"}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
WORKERS = 4
DELAY = 0.2  # пауза после каждого запроса в потоке, чтобы не грузить прод

OUT = Path(__file__).resolve().parent
RAW, ASSETS, DATA, MD = OUT / "raw", OUT / "assets", OUT / "data", OUT / "md"

# Служебные разделы Bitrix: личный кабинет, корзина, поиск, админка.
SKIP_PREFIXES = ("/bitrix/", "/auth/", "/personal/", "/search/", "/local/", "/include/", "/ajax/")
SKIP_RE = re.compile(r"compare\.php|/slide_show/|index\.php$")
# Умный фильтр даёт комбинаторный взрыв URL: такие ссылки только проверяем на статус.
CHECK_ONLY_RE = re.compile(r"/filter/")
FILE_EXT_RE = re.compile(
    r"\.(jpe?g|png|gif|webp|svg|ico|bmp|avif|pdf|docx?|xlsx?|pptx?|zip|rar|mp4|webm|mov|mp3|"
    r"css|js|woff2?|ttf|otf|eot|json|xml|txt)$", re.I)
UPLOAD_RE = re.compile(r"""(?:https?://(?:www\.)?nsp-center\.ru)?(/upload/[^"'()\s<>\\]+?\.(?:jpe?g|png|gif|webp|svg|pdf|mp4|webm|docx?|xlsx?))""", re.I)
CSS_URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+?)['"]?\s*\)""")
RESIZE_RE = re.compile(r"^/upload/resize_cache/(.+?)/\d+_\d+_\d+/([^/]+)$")

_local = threading.local()


def session() -> requests.Session:
    if not hasattr(_local, "s"):
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9"})
        _local.s = s
    return _local.s


def fetch(url: str, *, stream: bool = False) -> requests.Response | None:
    for attempt in range(3):
        try:
            r = session().get(url, timeout=40, allow_redirects=True, stream=stream)
            time.sleep(DELAY)
            if r.status_code >= 500 and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            return r
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
    return None


# ---------------------------------------------------------------- URL helpers

def is_internal(u: str) -> bool:
    p = urlparse(u)
    return p.scheme in ("http", "https") and p.netloc.lower() in HOSTS


def norm_page(href: str, base: str) -> str | None:
    """Канонический URL страницы или None, если это не страница для обхода."""
    href = (href or "").strip()
    if not href or href.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
        return None
    u = urljoin(base, href)
    if not is_internal(u):
        return None
    p = urlparse(u)
    path = p.path or "/"
    if path.startswith(SKIP_PREFIXES) or path.startswith("/upload/") or SKIP_RE.search(path):
        return None
    if FILE_EXT_RE.search(path):
        return None
    # Из query сохраняем только пагинацию Bitrix — остальное (сортировки, фильтры) дубли.
    q = [(k, v) for k, v in parse_qsl(p.query) if re.fullmatch(r"PAGEN_\d+", k)]
    return BASE + path + ("?" + urlencode(q) if q else "")


def norm_asset(href: str, base: str) -> str | None:
    href = (href or "").strip()
    if not href or href.startswith(("data:", "javascript:", "#", "mailto:", "tel:")):
        return None
    u = urljoin(base, href).split("#")[0]
    if not is_internal(u):
        return None
    p = urlparse(u)
    if p.path.startswith("/upload/") or FILE_EXT_RE.search(p.path):
        return BASE + p.path + ("?" + p.query if p.query and not p.path.endswith((".css", ".js")) else "")
    return None


def page_file(url: str, root: Path, suffix: str) -> Path:
    p = urlparse(url)
    path = unquote(p.path).strip("/")
    name = "index"
    if p.query:
        name += "~" + p.query.replace("=", "-").replace("&", "_")
    return root / path / (name + suffix)


def asset_file(url: str) -> Path:
    p = urlparse(url)
    return ASSETS / unquote(p.path).lstrip("/")


def read_raw(url: str) -> str | None:
    f = page_file(url, RAW, ".html.gz")
    return gzip.decompress(f.read_bytes()).decode("utf-8", "replace") if f.exists() else None


# ---------------------------------------------------------------- crawl

def collect_links(soup: BeautifulSoup, url: str) -> tuple[set[str], set[str], set[str], set[str]]:
    pages, checks, assets, external = set(), set(), set(), set()
    for a in soup.find_all(["a", "area"], href=True):
        href = a["href"]
        full = urljoin(url, href.strip())
        if full.startswith("http") and not is_internal(full):
            external.add(full)
            continue
        au = norm_asset(href, url)
        if au:
            assets.add(au)
            continue
        pu = norm_page(href, url)
        if pu:
            (checks if CHECK_ONLY_RE.search(urlparse(pu).path) else pages).add(pu)
    for el in soup.find_all(["img", "source", "video", "audio", "iframe", "embed"]):
        for attr in ("src", "data-src", "data-original", "data-lazy", "data-lazy-src", "poster", "data-bg"):
            if el.get(attr):
                au = norm_asset(el[attr], url)
                if au:
                    assets.add(au)
        for attr in ("srcset", "data-srcset"):
            for part in (el.get(attr) or "").split(","):
                au = norm_asset(part.strip().split(" ")[0], url)
                if au:
                    assets.add(au)
    for el in soup.find_all("link", href=True):
        au = norm_asset(el["href"], url)
        if au:
            assets.add(au)
    for el in soup.find_all("script", src=True):
        au = norm_asset(el["src"], url)
        if au:
            assets.add(au)
    for el in soup.find_all("meta", content=True):
        if (el.get("property") or el.get("name") or "").lower() in ("og:image", "twitter:image", "msapplication-tileimage"):
            au = norm_asset(el["content"], url)
            if au:
                assets.add(au)
    return pages, checks, assets, external


def crawl(refetch: bool) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    seeds = {BASE + "/"}
    sm = fetch(BASE + "/sitemap.xml")
    if sm is not None and sm.ok:
        for loc in re.findall(r"<loc>([^<]+)</loc>", sm.text):
            sub = fetch(loc)
            if sub is not None and sub.ok:
                for u in re.findall(r"<loc>([^<]+)</loc>", sub.text):
                    pu = norm_page(u, BASE)
                    if pu:
                        seeds.add(pu)
    seen: set[str] = set(seeds)
    checks_seen: set[str] = set()
    referrers: dict[str, set[str]] = collections.defaultdict(set)
    all_assets: set[str] = set()
    all_external: set[str] = set()
    log: list[dict] = []
    lock = threading.Lock()

    def work(url: str) -> tuple[dict, set[str], set[str]]:
        f = page_file(url, RAW, ".html.gz")
        meta_f = f.with_suffix("").with_suffix(".meta.json")
        if f.exists() and meta_f.exists() and not refetch:
            rec = json.loads(meta_f.read_text())
            html = gzip.decompress(f.read_bytes()).decode("utf-8", "replace")
        else:
            r = fetch(url)
            if r is None:
                return {"url": url, "status": None, "error": "network"}, set(), set()
            rec = {
                "url": url, "status": r.status_code, "final_url": r.url,
                "redirects": [h.url for h in r.history],
                "content_type": r.headers.get("Content-Type", ""),
                "bytes": len(r.content),
                "last_modified": r.headers.get("Last-Modified"),
                "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            if "html" not in rec["content_type"]:
                return rec, set(), set()
            html = r.text
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(gzip.compress(html.encode("utf-8")))
            meta_f.write_text(json.dumps(rec, ensure_ascii=False, indent=1))
        final = rec.get("final_url") or url
        if not is_internal(final):
            return rec, set(), set()
        soup = BeautifulSoup(html, "lxml")
        pages, checks, assets, external = collect_links(soup, final)
        assets |= {BASE + m for m in UPLOAD_RE.findall(html)}
        with lock:
            all_assets.update(assets)
            all_external.update(external)
            for p in pages | checks:
                referrers[p].add(url)
        return rec, pages, checks

    frontier = sorted(seeds)
    with ThreadPoolExecutor(WORKERS) as pool:
        while frontier:
            futures = {pool.submit(work, u): u for u in frontier}
            frontier = []
            for fut in as_completed(futures):
                rec, pages, checks = fut.result()
                rec["kind"] = "page"
                log.append(rec)
                for p in sorted(pages - seen):
                    seen.add(p)
                    frontier.append(p)
                checks_seen.update(checks)
            print(f"  crawl: {len(log)} страниц, в очереди {len(frontier)}", flush=True)
        # Ссылки умного фильтра — только статус.
        todo = sorted(checks_seen - seen)
        for rec in pool.map(lambda u: {"url": u, "status": getattr(fetch(u), "status_code", None), "kind": "check-only"}, todo):
            log.append(rec)

    uniq: dict[str, dict] = {}
    for rec in log:
        uniq.setdefault(rec["url"], rec)
    log = sorted(uniq.values(), key=lambda r: r["url"])
    for rec in log:
        rec["linked_from"] = sorted(referrers.get(rec["url"], ()))[:20]
    (DATA / "crawl.json").write_text(json.dumps(log, ensure_ascii=False, indent=1))
    (DATA / "assets-found.json").write_text(json.dumps(sorted(all_assets), ensure_ascii=False, indent=1))
    (DATA / "external-links.json").write_text(json.dumps(sorted(all_external), ensure_ascii=False, indent=1))
    ok = sum(1 for r in log if r.get("status") == 200 and r["kind"] == "page")
    print(f"crawl: {len(log)} URL, 200 OK: {ok}, ассетов найдено: {len(all_assets)}")


# ---------------------------------------------------------------- assets

def original_of(url: str) -> str:
    """resize_cache/iblock/273/90_90_0/x.jpg -> iblock/273/x.jpg (оригинал)."""
    m = RESIZE_RE.match(urlparse(url).path)
    return f"{BASE}/upload/{m.group(1)}/{m.group(2)}" if m else url


def download_assets(refetch: bool) -> None:
    found = json.loads((DATA / "assets-found.json").read_text())
    queue = sorted({original_of(u) for u in found})
    fallback = {original_of(u): u for u in found if original_of(u) != u}
    done: dict[str, dict] = {}
    lock = threading.Lock()

    def get(url: str) -> tuple[str, dict, list[str]]:
        dest = asset_file(url)
        if dest.exists() and not refetch:
            body = dest.read_bytes()
            status = 200
        else:
            r = fetch(url)
            if (r is None or r.status_code != 200) and url in fallback:
                r = fetch(fallback[url])
                url_used = fallback[url]
                dest = asset_file(url_used)
            else:
                url_used = url
            if r is None or r.status_code != 200:
                return url, {"status": getattr(r, "status_code", None)}, []
            body = r.content
            status = 200
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            url = url_used
        more: list[str] = []
        if dest.suffix.lower() == ".css":
            css = body.decode("utf-8", "replace")
            for ref in CSS_URL_RE.findall(css):
                au = norm_asset(ref, url)
                if au:
                    more.append(original_of(au))
        return url, {"status": status, "file": str(dest.relative_to(OUT)), "bytes": len(body)}, more

    seen = set(queue)
    with ThreadPoolExecutor(WORKERS) as pool:
        while queue:
            nxt: list[str] = []
            for i, (url, rec, more) in enumerate(pool.map(get, queue), 1):
                with lock:
                    done[url] = rec
                for m in more:
                    if m not in seen:
                        seen.add(m)
                        nxt.append(m)
                if i % 200 == 0:
                    print(f"  assets: {i}/{len(queue)}", flush=True)
            queue = nxt
    (DATA / "assets.json").write_text(json.dumps(dict(sorted(done.items())), ensure_ascii=False, indent=1))
    ok = [r for r in done.values() if r.get("status") == 200]
    print(f"assets: {len(ok)} скачано из {len(done)}, {sum(r['bytes'] for r in ok) / 1e6:.1f} МБ")


# ---------------------------------------------------------------- extract helpers

def txt(el: Tag | None, sep: str = " ") -> str:
    return re.sub(r"\s+", " ", el.get_text(sep, strip=True)).strip() if el else ""


def clean(soup: BeautifulSoup) -> BeautifulSoup:
    for s in soup(["script", "style", "noscript", "template"]):
        s.decompose()
    return soup


def page_type(path: str) -> str:
    if path == "/":
        return "home"
    if path.startswith("/product/"):
        return "product"
    if path == "/catalog/":
        return "catalog-root"
    if path.startswith("/catalog/"):
        return "catalog-section"
    if path == "/blog/":
        return "blog-list"
    if path.startswith("/blog/"):
        return "blog-post"
    return "page"


def layout(soup: BeautifulSoup) -> tuple[Tag | None, list[Tag], Tag | None]:
    """Шаблон Intec: .intec-template-content > div > [шапка, крошки, заголовок, контент...]."""
    root = soup.select_one(".intec-template-content > div")
    footer = soup.select_one(".intec-template-footer")
    if root is None:
        return None, [soup.body] if soup.body else [], footer
    kids = root.find_all(recursive=False)
    header = kids[0] if kids and kids[0].select_one(".sale-basket-small, [class*=header]") else None
    return header, [k for k in kids if k is not header], footer


def prop_value(el: Tag):
    if el.name == "meta":
        return el.get("content")
    if el.name in ("a", "link", "area"):
        return el.get("href")
    if el.name in ("img", "audio", "video", "source", "iframe", "embed"):
        return el.get("src")
    if el.name == "time":
        return el.get("datetime") or txt(el)
    if el.name in ("data", "meter"):
        return el.get("value")
    return el.get("content") or txt(el)


def iter_props(el: Tag):
    for c in el.find_all(True, recursive=False):
        if c.has_attr("itemprop"):
            yield c
            if c.has_attr("itemscope"):
                continue
        if not c.has_attr("itemscope"):
            yield from iter_props(c)


def md_item(el: Tag) -> dict:
    item: dict = {"@type": el.get("itemtype")}
    for prop in iter_props(el):
        val = md_item(prop) if prop.has_attr("itemscope") else prop_value(prop)
        for name in prop.get("itemprop", "").split():
            item.setdefault(name, []).append(val)
    return {k: (v[0] if isinstance(v, list) and len(v) == 1 else v) for k, v in item.items()}


def microdata(soup: BeautifulSoup) -> list[dict]:
    return [md_item(el) for el in soup.find_all(attrs={"itemscope": True}) if not el.has_attr("itemprop")]


def jsonld(soup: BeautifulSoup) -> list:
    out = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            out.append(json.loads(s.string or ""))
        except json.JSONDecodeError:
            out.append({"_raw": (s.string or "")[:2000]})
    return out


def meta_tags(soup: BeautifulSoup) -> dict:
    m: dict = {}
    for el in soup.find_all("meta"):
        k = el.get("name") or el.get("property") or el.get("http-equiv") or el.get("itemprop")
        if k and el.get("content") is not None:
            m[k] = el["content"]
    for el in soup.find_all("link", rel=True, href=True):
        rel = " ".join(el["rel"])
        if rel in ("canonical", "alternate", "prev", "next", "icon", "shortcut icon", "apple-touch-icon", "manifest"):
            m.setdefault("link:" + rel, []).append(urljoin(BASE, el["href"]))
    return m


def breadcrumbs(soup: BeautifulSoup) -> list[dict]:
    bc = soup.find(attrs={"itemtype": re.compile("BreadcrumbList")})
    out = []
    if bc:
        for it in bc.find_all(attrs={"itemprop": "itemListElement"}):
            a = it.find("a", href=True)
            name_el = it.find(attrs={"itemprop": "name"})
            out.append({"name": txt(name_el) or txt(it).rstrip("/ ").strip(),
                        "url": urljoin(BASE, a["href"]) if a else None})
    return out


def images(els: list[Tag], base: str) -> list[dict]:
    out, seen = [], set()
    for root in els:
        for img in root.find_all("img"):
            src = img.get("data-src") or img.get("data-original") or img.get("src")
            if not src or src.startswith("data:"):
                continue
            u = urljoin(base, src)
            if u in seen:
                continue
            seen.add(u)
            out.append({"src": u, "original": original_of(u) if is_internal(u) else u,
                        "alt": img.get("alt"), "title": img.get("title")})
        for el in root.find_all(style=CSS_URL_RE):
            for ref in CSS_URL_RE.findall(el["style"]):
                u = urljoin(base, ref)
                if u not in seen and not ref.startswith("data:"):
                    seen.add(u)
                    out.append({"src": u, "original": original_of(u) if is_internal(u) else u,
                                "alt": None, "title": el.get("title"), "background": True})
    return out


def links(els: list[Tag], base: str) -> list[dict]:
    out, seen = [], set()
    for root in els:
        for a in root.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("javascript:", "#")) or not href:
                continue
            u = urljoin(base, href)
            key = (u, txt(a))
            if key in seen:
                continue
            seen.add(key)
            out.append({"text": txt(a) or a.get("title") or (a.find("img") or {}).get("alt"), "url": u})
    return out


def forms(soup: BeautifulSoup, base: str) -> list[dict]:
    out = []
    for f in soup.find_all("form"):
        fields = []
        for el in f.find_all(["input", "select", "textarea", "button"]):
            t = el.get("type") or el.name
            if t == "hidden":
                continue
            label = None
            if el.get("id"):
                lab = f.find("label", attrs={"for": el["id"]})
                label = txt(lab) or None
            fields.append({"tag": el.name, "type": t, "name": el.get("name"), "placeholder": el.get("placeholder"),
                           "label": label, "required": el.has_attr("required"),
                           "text": txt(el) if el.name == "button" else None,
                           "options": [txt(o) for o in el.find_all("option")] if el.name == "select" else None})
        out.append({"name": f.get("name"), "id": f.get("id"), "action": urljoin(base, f.get("action") or ""),
                    "method": (f.get("method") or "get").lower(), "title": txt(f.find(["h1", "h2", "h3", "h4"])) or None,
                    "fields": fields})
    return out


def to_md(els: list[Tag]) -> str:
    html = "".join(str(e) for e in els)
    md = markdownify(html, heading_style="ATX", strip=["svg"], bullets="-")
    md = re.sub(r"\n[ \t]+\n", "\n\n", md)
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"


def num(s: str) -> float | None:
    s = re.sub(r"[^\d,.]", "", s or "").replace(",", ".")
    try:
        return float(s) if s else None
    except ValueError:
        return None


# ---------------------------------------------------------------- per-type extractors

def extract_product(soup: BeautifulSoup, url: str, md: list[dict]) -> dict:
    item = next((i for i in md if "Product" in (i.get("@type") or "")), {})

    def first_dict(v) -> dict:
        # У наборов microdata содержит несколько Offer — берём первый (цена самого набора).
        if isinstance(v, list):
            v = next((x for x in v if isinstance(x, dict)), {})
        return v if isinstance(v, dict) else {}

    offers = first_dict(item.get("offers"))
    rating = first_dict(item.get("aggregateRating"))
    # На страницах наборов Offer/AggregateRating свёрстаны вне itemscope Product —
    # поисковик их к товару не привяжет; берём их отдельно и помечаем в audit.
    orphan = []
    if not offers and (el := soup.find(attrs={"itemprop": "offers", "itemscope": True})):
        offers = md_item(el)
        orphan.append("offers")
    if not rating and (el := soup.find(attrs={"itemprop": "aggregateRating", "itemscope": True})):
        rating = md_item(el)
        orphan.append("aggregateRating")
    props: dict[str, str] = {}
    for p in soup.select(".catalog-element-section-property"):
        k = txt(p.select_one(".catalog-element-section-property-name"))
        v = txt(p.select_one(".catalog-element-section-property-value")).rstrip(";").strip()
        if k:
            props[k] = v
    if not props:
        for p in soup.select(".catalog-element-property"):
            k = txt(p.select_one(".catalog-element-property-name"))
            if k:
                props[k] = txt(p.select_one(".catalog-element-property-value")).rstrip(";").strip()
    sections = {}
    for s in soup.select(".catalog-element-section"):
        name = txt(s.select_one(".catalog-element-section-name")) or "(без заголовка)"
        content = s.select_one(".catalog-element-section-content") or s
        sections[name] = to_md([content]).strip()
    docs = []
    for d in soup.select(".catalog-element-section-document"):
        a = d if d.name == "a" and d.get("href") else d.find("a", href=True) or d.find_parent("a", href=True)
        docs.append({"name": txt(d.select_one(".catalog-element-section-document-name")),
                     "size": txt(d.select_one(".catalog-element-section-document-size")),
                     "url": urljoin(BASE, a["href"]) if a else None})
    gallery = []
    for sel in (".catalog-element-gallery", "[class*=catalog-element-gallery]", "[class*=catalog-element-picture]"):
        for el in soup.select(sel):
            for im in images([el], url):
                if im["original"] not in gallery:
                    gallery.append(im["original"])
    if item.get("image"):
        for im in item["image"] if isinstance(item["image"], list) else [item["image"]]:
            u = urljoin(BASE, im)
            if u not in gallery:
                gallery.insert(0, u)
    avail = offers.get("availability") or ""
    base_price = num(txt(soup.select_one(".catalog-element-price-base .catalog-element-price-value")))
    return {
        "url": url,
        "name": item.get("name") or txt(soup.h1),
        "article": txt(soup.select_one(".catalog-element-article-value")) or None,
        "price": num(str(offers.get("price") or "")),
        "price_base": base_price,
        "discount": txt(soup.select_one(".catalog-element-price-percent")) or None,
        "currency": offers.get("priceCurrency"),
        "availability": avail.rsplit("/", 1)[-1] or None,
        "availability_text": txt(soup.select_one(".catalog-element-quantity")) or None,
        "brand": item.get("brand") if isinstance(item.get("brand"), str) else (item.get("brand") or {}).get("name") if isinstance(item.get("brand"), dict) else None,
        "category": item.get("category"),
        "breadcrumbs": breadcrumbs(soup),
        "rating": num(str(rating.get("ratingValue") or "")),
        "review_count": num(str(rating.get("reviewCount") or "")),
        "properties": props,
        "sections": sections,
        "documents": docs,
        "images": gallery,
        "microdata_outside_product": orphan,
        "related": sorted({l["url"] for l in links([soup], url) if "/product/" in l["url"] and urlparse(l["url"]).path != urlparse(url).path}),
    }


def extract_section(soup: BeautifulSoup, url: str, body: list[Tag]) -> dict:
    prods = []
    for el in body:
        for a in el.find_all("a", href=True):
            u = urljoin(BASE, a["href"])
            if urlparse(u).path.startswith("/product/") and u not in prods:
                prods.append(u.split("?")[0])
    pages = sorted({urljoin(BASE, a["href"]) for el in body for a in el.find_all("a", href=re.compile(r"PAGEN_\d+="))})
    desc = soup.select_one("[class*=catalog-section-description], [class*=section-description], .intec-ui-markup-text")
    return {"url": url, "name": txt(soup.h1), "breadcrumbs": breadcrumbs(soup), "description": txt(desc) or None,
            "products": prods, "pagination": pages}


def extract_site(soup: BeautifulSoup, header: Tag | None, footer: Tag | None) -> dict:
    parts = [e for e in (header, footer) if e is not None]
    all_links = links(parts, BASE)
    logo = soup.select_one("[class*=logo] img, img[class*=logo], [class*=logotype] img")
    return {
        "title": txt(soup.title),
        "logo": urljoin(BASE, logo.get("src")) if logo and logo.get("src") else None,
        "phones": sorted({l["url"].split(":", 1)[1].strip() for l in all_links if l["url"].startswith("tel:")}),
        "emails": sorted({l["url"].split(":", 1)[1].strip() for l in all_links if l["url"].startswith("mailto:")}),
        "external_links": sorted({l["url"] for l in all_links if l["url"].startswith("http") and not is_internal(l["url"])}),
        "header_text": txt(header),
        "header_links": links([header], BASE) if header else [],
        "footer_text": txt(footer),
        "footer_links": links([footer], BASE) if footer else [],
    }


def extract_design() -> dict:
    colors, fonts, faces, sizes = collections.Counter(), collections.Counter(), set(), collections.Counter()
    # Цвета темы Intec генерируются инлайн-<style> в самой странице, а не в файлах CSS.
    home = BeautifulSoup(read_raw(BASE + "/") or "", "lxml")
    inline = "\n".join(st.get_text() for st in home.find_all("style"))
    theme = collections.Counter(c.lower() for c in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]+\)", inline))
    for css in ASSETS.rglob("*.css"):
        t = css.read_text("utf-8", "replace")
        for c in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]+\)", t):
            colors[c.lower().replace(" ", "")] += 1
        for f in re.findall(r"font-family\s*:\s*([^;}{]+)", t):
            fonts[f.strip().strip("'\"")] += 1
        for block in re.findall(r"@font-face\s*{([^}]+)}", t):
            m = re.search(r"font-family\s*:\s*['\"]?([^;'\"]+)", block)
            if m:
                faces.add(m.group(1).strip())
        for s in re.findall(r"font-size\s*:\s*([\d.]+(?:px|rem|em))", t):
            sizes[s] += 1
    return {"note": "частоты по всем скачанным CSS сайта (включая библиотеки); theme_colors_inline — цвета темы из <style> главной",
            "theme_colors_inline": theme.most_common(30),
            "colors_top": colors.most_common(60), "font_families_top": fonts.most_common(30),
            "font_faces": sorted(faces), "font_sizes_top": sizes.most_common(30)}


def extract() -> None:
    crawl_log = json.loads((DATA / "crawl.json").read_text())
    pages_out, products, sections, posts = [], [], {}, []
    site: dict | None = None
    MD.mkdir(parents=True, exist_ok=True)
    for rec in crawl_log:
        if rec["kind"] != "page" or rec.get("status") != 200:
            continue
        url = rec["url"]
        html = read_raw(url)
        if html is None:
            continue
        raw_soup = BeautifulSoup(html, "lxml")
        md_items, ld = microdata(raw_soup), jsonld(raw_soup)
        soup = clean(raw_soup)
        header, body, footer = layout(soup)
        path = urlparse(url).path
        kind = page_type(path)
        if site is None or kind == "home":
            site = extract_site(soup, header, footer)
        md_text = to_md(body)
        md_path = page_file(url, MD, ".md")
        md_path.parent.mkdir(parents=True, exist_ok=True)
        meta = meta_tags(soup)
        front = {"url": url, "title": txt(soup.title), "description": meta.get("description"), "type": kind}
        md_path.write_text("---\n" + "".join(f"{k}: {json.dumps(v, ensure_ascii=False)}\n" for k, v in front.items()) + "---\n\n" + md_text)
        body_text = " ".join(txt(e) for e in body)
        page = {
            "url": url, "path": path, "type": kind, "status": rec["status"],
            "title": txt(soup.title), "h1": txt(soup.h1) or None, "meta": meta,
            "headings": [{"level": int(h.name[1]), "text": txt(h)} for e in body for h in e.find_all(re.compile(r"^h[1-6]$")) if txt(h)],
            "breadcrumbs": breadcrumbs(soup),
            "text": body_text, "words": len(body_text.split()),
            "markdown": str(md_path.relative_to(OUT)),
            "raw_html": str(page_file(url, RAW, ".html.gz").relative_to(OUT)),
            "links": links(body, url), "images": images(body, url), "forms": forms(soup, url),
            "microdata": md_items, "jsonld": ld,
        }
        pages_out.append(page)
        if kind == "product":
            products.append(extract_product(soup, url, md_items))
        elif kind in ("catalog-section", "catalog-root"):
            base = url.split("?")[0]
            sec = extract_section(soup, base, body)
            if base in sections:
                sections[base]["products"] += [p for p in sec["products"] if p not in sections[base]["products"]]
            else:
                sections[base] = sec
        elif kind == "blog-post":
            date = soup.select_one("time, [class*=date]")
            posts.append({"url": url, "title": page["h1"], "date": txt(date) or None,
                          "description": meta.get("description"), "images": [i["original"] for i in page["images"]],
                          "markdown": page["markdown"], "text": body_text})

    # Дерево каталога — по хлебным крошкам раздела (боковое меню одинаково на всех страницах).
    for sec in sections.values():
        crumbs = [b["url"] for b in sec["breadcrumbs"] if b.get("url") and b["url"] not in (BASE + "/", sec["url"])]
        sec["parent"] = crumbs[-1] if crumbs else None
    for sec in sections.values():
        sec["children"] = [c["url"] for c in sections.values() if c.get("parent") == sec["url"]]
    with (DATA / "pages.jsonl").open("w") as f:
        for p in pages_out:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    (DATA / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=1))
    (DATA / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=1))
    (DATA / "catalog.json").write_text(json.dumps(list(sections.values()), ensure_ascii=False, indent=1))
    (DATA / "blog.json").write_text(json.dumps(posts, ensure_ascii=False, indent=1))
    prop_keys = sorted({k for p in products for k in p["properties"]})
    with (DATA / "products.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        head = ["url", "name", "article", "price", "price_base", "discount", "currency", "availability",
                "brand", "category", "path", "rating", "review_count", "images"]
        w.writerow(head + prop_keys)
        for p in products:
            w.writerow([p["url"], p["name"], p["article"], p["price"], p["price_base"], p["discount"], p["currency"],
                        p["availability"], p["brand"], p["category"], " / ".join(b["name"] for b in p["breadcrumbs"]),
                        p["rating"], p["review_count"], " ".join(p["images"])] + [p["properties"].get(k, "") for k in prop_keys])
    # SEO/качество: битые ссылки, дубли title, пустые description.
    broken = [{"url": r["url"], "status": r.get("status"), "linked_from": r.get("linked_from")}
              for r in crawl_log if r.get("status") != 200]
    titles = collections.defaultdict(list)
    for p in pages_out:
        titles[p["title"]].append(p["url"])
    audit = {
        "broken_links": broken,
        "duplicate_titles": {t: u for t, u in titles.items() if len(u) > 1},
        "missing_description": [p["url"] for p in pages_out if not p["meta"].get("description")],
        "missing_h1": [p["url"] for p in pages_out if not p["h1"]],
        "microdata_outside_product": [p["url"] for p in products if p["microdata_outside_product"]],
        "images_without_alt": sum(1 for p in pages_out for i in p["images"] if not i.get("alt") and not i.get("background")),
    }
    (DATA / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=1))
    if ASSETS.exists():
        (DATA / "design.json").write_text(json.dumps(extract_design(), ensure_ascii=False, indent=1))
    by_type = collections.Counter(p["type"] for p in pages_out)
    print(f"extract: страниц {len(pages_out)} {dict(by_type)}, товаров {len(products)}, "
          f"разделов {len(sections)}, статей {len(posts)}, битых URL {len(broken)}")


def main() -> None:
    args = set(sys.argv[1:])
    refetch = "--refetch" in args
    stages = [a for a in args if not a.startswith("--")] or ["crawl", "assets", "extract"]
    if "crawl" in stages:
        crawl(refetch)
    if "assets" in stages:
        download_assets(refetch)
    if "extract" in stages:
        extract()


if __name__ == "__main__":
    main()
