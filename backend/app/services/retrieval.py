import math
import re
from collections import Counter
from typing import Any

from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.schemas.query import SourceCitation


def tokenize(text: str) -> list[str]:
    """Extract lowercase alphanumeric tokens from text."""
    return re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())


def bm25_rank(
    query_tokens: list[str],
    corpus_tokens: list[list[str]],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[float]:
    """Calculate Okapi BM25 scores for a query across corpus token lists."""
    num_docs = len(corpus_tokens)
    if num_docs == 0:
        return []

    doc_lengths = [len(doc) for doc in corpus_tokens]
    avg_dl = sum(doc_lengths) / num_docs if num_docs > 0 else 1.0

    # Calculate document frequency for query terms
    df: Counter[str] = Counter()
    for doc in corpus_tokens:
        unique_terms = set(doc)
        for term in query_tokens:
            if term in unique_terms:
                df[term] += 1

    # Calculate IDF for each query term
    idf: dict[str, float] = {}
    for term in query_tokens:
        n_q = df[term]
        idf[term] = math.log(1.0 + (num_docs - n_q + 0.5) / (n_q + 0.5))

    scores: list[float] = []
    for idx, doc in enumerate(corpus_tokens):
        score = 0.0
        doc_len = doc_lengths[idx]
        term_freqs = Counter(doc)
        for term in query_tokens:
            if term not in term_freqs:
                continue
            tf = term_freqs[term]
            num = tf * (k1 + 1.0)
            denom = tf + k1 * (1.0 - b + b * (doc_len / avg_dl if avg_dl > 0 else 1.0))
            score += idf[term] * (num / denom)
        scores.append(round(score, 4))

    return scores


def semantic_vector_rank(
    query_tokens: list[str],
    corpus_tokens: list[list[str]],
) -> list[float]:
    """Calculate cosine similarity over n-gram/token term vectors."""
    if not corpus_tokens:
        return []

    query_counts = Counter(query_tokens)
    query_norm = math.sqrt(sum(c * c for c in query_counts.values()))
    if query_norm == 0.0:
        return [0.0] * len(corpus_tokens)

    scores: list[float] = []
    for doc in corpus_tokens:
        doc_counts = Counter(doc)
        doc_norm = math.sqrt(sum(c * c for c in doc_counts.values()))
        if doc_norm == 0.0:
            scores.append(0.0)
            continue

        dot_product = sum(query_counts[term] * doc_counts[term] for term in query_counts if term in doc_counts)
        cosine_sim = dot_product / (query_norm * doc_norm)
        scores.append(round(cosine_sim, 4))

    return scores


def reciprocal_rank_fusion(
    bm25_order: list[int],
    semantic_order: list[int],
    total_docs: int,
    k: int = 60,
) -> list[tuple[int, float]]:
    """Compute Reciprocal Rank Fusion scores across two ranked result lists."""
    rrf_scores: dict[int, float] = {i: 0.0 for i in range(total_docs)}

    for rank, doc_idx in enumerate(bm25_order):
        rrf_scores[doc_idx] += 1.0 / (k + rank + 1)

    for rank, doc_idx in enumerate(semantic_order):
        rrf_scores[doc_idx] += 1.0 / (k + rank + 1)

    sorted_results = sorted(rrf_scores.items(), key=lambda item: item[1], reverse=True)
    return sorted_results


def retrieve_chunks(
    db: Session,
    *,
    project_id: int,
    query: str,
    top_k: int = 5,
    mode: str = "hybrid",
) -> list[SourceCitation]:
    """Retrieve top-K relevant chunks for a project using BM25, semantic, or hybrid search."""
    # Fetch all chunks and parent documents for the project
    rows = (
        db.query(DocumentChunk, Document.name)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.project_id == project_id)
        .all()
    )

    if not rows:
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    corpus_tokens = [tokenize(chunk.content) for chunk, _ in rows]
    total_docs = len(rows)

    bm25_scores = bm25_rank(query_tokens, corpus_tokens)
    semantic_scores = semantic_vector_rank(query_tokens, corpus_tokens)

    # Rank indices (descending score)
    bm25_order = sorted(range(total_docs), key=lambda i: bm25_scores[i], reverse=True)
    semantic_order = sorted(range(total_docs), key=lambda i: semantic_scores[i], reverse=True)

    if mode == "bm25":
        ranked_indices = [(idx, bm25_scores[idx]) for idx in bm25_order]
    elif mode == "semantic":
        ranked_indices = [(idx, semantic_scores[idx]) for idx in semantic_order]
    else:  # hybrid RRF
        rrf_ranked = reciprocal_rank_fusion(bm25_order, semantic_order, total_docs)
        ranked_indices = [(idx, round(score, 6)) for idx, score in rrf_ranked]

    # Filter out chunks with zero relevance score unless none match
    filtered = [item for item in ranked_indices if item[1] > 0.0]
    top_results = filtered[:top_k] if filtered else ranked_indices[:top_k]

    citations: list[SourceCitation] = []
    for idx, score in top_results:
        chunk, doc_name = rows[idx]
        citations.append(
            SourceCitation(
                document_id=chunk.document_id,
                document_name=doc_name,
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                score=score,
            )
        )

    return citations

