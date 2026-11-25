import numpy as np
from google.genai import types
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.services.llm import _client, _is_transient

EMBED_MODEL = "gemini-embedding-001"
DIM = 384  # matches Vector(384) in skill_embeddings


@retry(
    retry=retry_if_exception(_is_transient),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=4, max=30),
    reraise=True,
)
def embed(texts: list[str]) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        resp = _client.models.embed_content(
            model=EMBED_MODEL,
            contents=texts[i:i + 100],
            config=types.EmbedContentConfig(
                task_type="SEMANTIC_SIMILARITY", output_dimensionality=DIM
            ),
        )
        for e in resp.embeddings:
            v = np.array(e.values, dtype=float)
            out.append((v / np.linalg.norm(v)).tolist())  # normalize for cosine
    return out