import io
from pathlib import Path
import os
import fitz
import pytesseract
from docx import Document as Docx
from PIL import Image, ImageOps

from app.config import settings

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

if settings.TESSDATA_PREFIX:
    os.environ["TESSDATA_PREFIX"] = settings.TESSDATA_PREFIX

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


def _ocr_image(img: Image.Image) -> str:
    img = ImageOps.exif_transpose(img)          # fix phone-photo rotation
    img = ImageOps.autocontrast(ImageOps.grayscale(img))
    return pytesseract.image_to_string(img)


def _pdf(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    if len(text.strip()) >= 30 * max(len(doc), 1):
        return text
    # scanned PDF -> OCR each page
    pages = []
    for page in doc:
        png = page.get_pixmap(dpi=300).tobytes("png")
        pages.append(_ocr_image(Image.open(io.BytesIO(png))))
    return "\n".join(pages)


def _docx(data: bytes) -> str:
    d = Docx(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for t in d.tables:
        for row in t.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells))
    return "\n".join(parts)


def extract_text(filename: str, data: bytes) -> tuple[str, str]:
    """Returns (text, file_type)."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _pdf(data).strip(), "pdf"
    if ext == ".docx":
        return _docx(data).strip(), "docx"
    if ext in IMAGE_EXT:
        return _ocr_image(Image.open(io.BytesIO(data))).strip(), "image"
    raise ValueError(f"Unsupported file type: {ext}")