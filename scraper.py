import os
import re
import sys
import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

EXTENSIONES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


def crear_sesion(retries=3, backoff=0.5):
    sesion = requests.Session()
    sesion.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    retry = Retry(
        total=retries,
        backoff_factor=backoff,
        status_forcelist=[500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry)
    sesion.mount("http://", adapter)
    sesion.mount("https://", adapter)
    return sesion


def descargar_imagen(sesion, url_img, ruta_destino, idx):
    try:
        resp = sesion.get(url_img, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
        ext = EXTENSIONES.get(content_type, "jpg")
        nombre = f"imagen_{idx:04d}.{ext}"
        ruta = Path(ruta_destino) / nombre
        with open(ruta, "wb") as f:
            f.write(resp.content)
        return f"OK   {ruta.name}"
    except Exception as e:
        return f"FAIL {url_img} -> {e}"


def extraer_urls_imagenes(soup, url_base):
    urls = set()
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if src:
            urls.add(urljoin(url_base, src))
        srcset = img.get("srcset", "")
        for parte in srcset.split(","):
            valores = parte.strip().split()
            if valores:
                urls.add(urljoin(url_base, valores[0]))
    return list(urls)


def extraer_texto(soup):
    texto = []
    for tag in ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote"]:
        for elem in soup.find_all(tag):
            t = elem.get_text(strip=True)
            if t:
                prefijo = f"{tag}: " if tag.startswith("h") else "  - " if tag == "li" else ""
                texto.append(f"{prefijo}{t}")
    return "\n".join(texto)


def extraer_markdown(soup):
    lineas = ["# Poppers extraidos", ""]
    patron_precio = re.compile(r"^(.*?)\s+(Q\s*\d+(?:[.,]\d{1,2})?)$")

    for elem in soup.select("h1, h2, h3, h4, h5, h6, p, li, blockquote"):
        if elem.find_parent(["nav", "header", "footer"]):
            continue

        texto = elem.get_text(" ", strip=True)
        if not texto:
            continue

        if elem.name.startswith("h"):
            nivel = min(int(elem.name[1]) + 1, 6)
            lineas.extend([f"{'#' * nivel} {texto}", ""])
        elif elem.name == "li":
            lineas.append(f"- {texto}")
        else:
            producto = patron_precio.match(texto)
            if producto:
                lineas.extend(
                    [f"- **{producto.group(1).strip()}** - {producto.group(2)}", ""]
                )
            else:
                lineas.extend([texto, ""])

    return "\n".join(lineas).strip() + "\n"

def main():
    parser = argparse.ArgumentParser(description="Web Scraper: texto + imagenes")
    parser.add_argument("url", help="URL del sitio a scrapear")
    parser.add_argument("-o", "--output", default="descargas",
                        help="Carpeta de salida (default: descargas)")
    parser.add_argument("-t", "--texto", action="store_true",
                        help="Guardar tambien el texto extraido")
    parser.add_argument("-w", "--workers", type=int, default=5,
                        help="Descargas concurrentes (default: 5)")
    parser.add_argument("--solo-imagenes", action="store_true",
                        help="Solo descargar imagenes, sin texto")
    parser.add_argument("--markdown", action="store_true",
                        help="Guardar el contenido extraido como Markdown")
    parser.add_argument("--solo-texto", action="store_true",
                        help="No descargar imagenes")
    args = parser.parse_args()

    carpeta_base = Path(args.output)
    carpeta_img = carpeta_base / "imagenes"

    sesion = crear_sesion()

    log.info(f"Descargando: {args.url}")
    try:
        resp = sesion.get(args.url, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        log.error(f"No se pudo acceder a {args.url}: {e}")
        sys.exit(1)

    soup = BeautifulSoup(resp.text, "html.parser")

    if args.markdown:
        carpeta_base.mkdir(parents=True, exist_ok=True)
        ruta_markdown = carpeta_base / "poppers_extraidos.md"
        ruta_markdown.write_text(extraer_markdown(soup), encoding="utf-8")
        log.info(f"Markdown guardado en: {ruta_markdown}")

    if args.texto:
        texto = extraer_texto(soup)
        carpeta_base.mkdir(parents=True, exist_ok=True)
        ruta_texto = carpeta_base / "texto_extraido.txt"
        ruta_texto.write_text(texto, encoding="utf-8")
        log.info(f"Texto guardado en: {ruta_texto}")

    if args.solo_texto:
        return

    urls_imagenes = extraer_urls_imagenes(soup, args.url)
    if not urls_imagenes:
        log.warning("No se encontraron imagenes.")
        return

    carpeta_img.mkdir(parents=True, exist_ok=True)
    log.info(f"Descargando {len(urls_imagenes)} imagenes ({args.workers} workers)...")

    resultados = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuros = {
            pool.submit(descargar_imagen, sesion, url, carpeta_img, i): url
            for i, url in enumerate(urls_imagenes, 1)
        }
        for futuro in tqdm(as_completed(futuros), total=len(futuros), desc="Imagenes"):
            resultados.append(futuro.result())

    for r in resultados:
        log.info(r)


if __name__ == "__main__":
    main()



