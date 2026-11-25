import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.config import settings


def get_object_storage_client() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_ENDPOINT_URL_S3,
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(s3={"addressing_style": "path"}),
    )


def check_object_storage() -> None:
    get_object_storage_client().head_bucket(Bucket=settings.OBJECT_STORAGE_BUCKET)


def upload_object(
    key: str, content: bytes, content_type: str | None = None
) -> None:
    request = {
        "Bucket": settings.OBJECT_STORAGE_BUCKET,
        "Key": key,
        "Body": content,
    }
    if content_type is not None:
        request["ContentType"] = content_type
    get_object_storage_client().put_object(**request)


def download_object(key: str) -> bytes:
    response = get_object_storage_client().get_object(
        Bucket=settings.OBJECT_STORAGE_BUCKET,
        Key=key,
    )
    body = response["Body"]
    try:
        return body.read()
    finally:
        body.close()


def delete_object(key: str) -> None:
    get_object_storage_client().delete_object(
        Bucket=settings.OBJECT_STORAGE_BUCKET,
        Key=key,
    )