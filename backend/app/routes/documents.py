from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.models.tables import Document, User
from app.services.ocr import extract_text
from app.security import get_current_user, require_owner

router = APIRouter(prefix="/documents", tags=["documents"])
MAX_BYTES = 10 * 1024 * 1024


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 10MB)")
    try:
        text, ftype = extract_text(file.filename, data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    doc = Document(user_id=current_user.id, filename=file.filename or "upload", file_type=ftype, extracted_text=text)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "file_type": ftype, "chars": len(text), "preview": text[:300]}


@router.get("/{doc_id}")
def get_doc(doc_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(404, "Not found")
    return {"id": doc.id, "filename": doc.filename, "file_type": doc.file_type, "text": doc.extracted_text}

@router.delete("/{doc_id}")
def delete_doc(doc_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(404, "Not found")
    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}

@router.get("")
def list_docs(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_owner(user_id, current_user)
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.id).all()
    return [{"id": d.id, "filename": d.filename, "file_type": d.file_type, "chars": len(d.extracted_text or "")} for d in docs]