from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Document, User
from app.services.ocr import extract_text

router = APIRouter(prefix="/documents", tags=["documents"])
MAX_BYTES = 10 * 1024 * 1024


@router.post("/upload")
async def upload(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(404, "User not found")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 10MB)")
    try:
        text, ftype = extract_text(file.filename, data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    doc = Document(user_id=user_id, filename=file.filename, file_type=ftype, extracted_text=text)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "file_type": ftype, "chars": len(text), "preview": text[:300]}


@router.get("/{doc_id}")
def get_doc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
    return {"id": doc.id, "filename": doc.filename, "file_type": doc.file_type, "text": doc.extracted_text}