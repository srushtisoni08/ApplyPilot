from cryptography.fernet import Fernet
from app.config import settings

_f = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(value: str) -> str:
    return _f.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _f.decrypt(value.encode()).decode()