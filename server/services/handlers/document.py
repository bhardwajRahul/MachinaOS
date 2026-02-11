"""Document processing handlers for MachinaOs workflow nodes.

Each handler is an independent async function that can be executed by
the Temporal worker system for distributed processing.

Handlers:
- handle_http_scraper: Scrape links from web pages with pagination
- handle_file_downloader: Download files in parallel
- handle_document_parser: Parse documents (PyPDF, Marker, Unstructured)
- handle_text_chunker: Split text into chunks (LangChain)
- handle_embedding_generator: Generate embeddings (HF, OpenAI, Ollama)
- handle_vector_store: Store/query vectors (ChromaDB, Qdrant, Pinecone)
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any
from urllib.parse import urljoin, urlparse, unquote

from core.logging import get_logger

logger = get_logger(__name__)


# =============================================================================
# HTTP Scraper
# =============================================================================

async def handle_http_scraper(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Scrape links from web pages with date/page pagination support."""
    import httpx
    from bs4 import BeautifulSoup
    start_time = time.time()

    try:
        url = parameters.get('url', '')
        iteration_mode = parameters.get('iterationMode', 'single')
        link_selector = parameters.get('linkSelector', 'a[href$=".pdf"]')
        headers_str = parameters.get('headers', '{}')

        if not url:
            raise ValueError("URL is required")

        headers = json.loads(headers_str) if headers_str else {}
        items, errors = [], []
        urls_to_fetch = []

        if iteration_mode == 'date':
            start_date = parameters.get('startDate', '')
            end_date = parameters.get('endDate', '')
            placeholder = parameters.get('datePlaceholder', '{date}')
            if not start_date or not end_date:
                raise ValueError("Start/end dates required for date mode")
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            current = start
            while current <= end:
                urls_to_fetch.append((
                    url.replace(placeholder, current.strftime("%Y-%m-%d")),
                    {'date': current.isoformat()}
                ))
                current += timedelta(days=1)
        elif iteration_mode == 'page':
            start_page = int(parameters.get('startPage', 1))
            end_page = int(parameters.get('endPage', 10))
            for page in range(start_page, end_page + 1):
                urls_to_fetch.append((url.replace('{page}', str(page)), {'page': page}))
        else:
            urls_to_fetch.append((url, {}))

        logger.info("[httpScraper] Starting", node_id=node_id, urls=len(urls_to_fetch))

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for fetch_url, meta in urls_to_fetch:
                try:
                    response = await client.get(fetch_url, headers=headers)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    for el in soup.select(link_selector):
                        href = el.get('href', '')
                        if href:
                            items.append({
                                'url': urljoin(fetch_url, href),
                                'text': el.get_text(strip=True),
                                'source_url': fetch_url,
                                **meta
                            })
                except Exception as e:
                    errors.append(f"{fetch_url}: {str(e)}")

        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": {"items": items, "item_count": len(items), "errors": errors},
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[httpScraper] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# File Downloader
# =============================================================================

async def handle_file_downloader(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Download files from URLs in parallel using semaphore for concurrency."""
    import httpx
    start_time = time.time()

    try:
        items = parameters.get('items', [])
        output_dir = Path(parameters.get('outputDir', './data/downloads'))
        max_workers = int(parameters.get('maxWorkers', 8))
        skip_existing = parameters.get('skipExisting', True)
        timeout = float(parameters.get('timeout', 60))

        if not items:
            return {
                "success": True, "node_id": node_id, "node_type": node_type,
                "result": {"downloaded": 0, "skipped": 0, "failed": 0, "files": []},
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        output_dir.mkdir(parents=True, exist_ok=True)
        downloaded, skipped, failed = [], [], []
        semaphore = asyncio.Semaphore(max_workers)

        async def download_file(item):
            async with semaphore:
                url = item.get('url', '') if isinstance(item, dict) else str(item)
                if not url:
                    return {'status': 'failed', 'error': 'Empty URL'}
                filename = unquote(Path(urlparse(url).path).name or 'download')
                file_path = output_dir / filename
                if skip_existing and file_path.exists():
                    return {'status': 'skipped', 'path': str(file_path), 'url': url}
                try:
                    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                        response = await client.get(url)
                        response.raise_for_status()
                        file_path.write_bytes(response.content)
                        return {'status': 'downloaded', 'path': str(file_path), 'url': url,
                                'size': len(response.content), 'filename': filename}
                except Exception as e:
                    return {'status': 'failed', 'url': url, 'error': str(e)}

        logger.info("[fileDownloader] Starting", node_id=node_id, items=len(items))
        results = await asyncio.gather(*[download_file(i) for i in items], return_exceptions=True)

        for r in results:
            if isinstance(r, Exception):
                failed.append({'error': str(r)})
            elif r.get('status') == 'downloaded':
                downloaded.append(r)
            elif r.get('status') == 'skipped':
                skipped.append(r)
            else:
                failed.append(r)

        return {
            "success": True, "node_id": node_id, "node_type": node_type,
            "result": {"downloaded": len(downloaded), "skipped": len(skipped),
                      "failed": len(failed), "files": downloaded, "output_dir": str(output_dir)},
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[fileDownloader] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# Document Parser
# =============================================================================

def _parse_file_sync(path: Path, parser: str) -> str:
    """Synchronous file parsing - runs in thread pool."""
    if parser == 'pypdf':
        from pypdf import PdfReader
        return "\n\n".join(p.extract_text() or '' for p in PdfReader(str(path)).pages)
    elif parser == 'marker':
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        converter = PdfConverter(artifact_dict=create_model_dict())
        result = converter(str(path))
        return result.markdown if hasattr(result, 'markdown') else str(result)
    elif parser == 'unstructured':
        from unstructured.partition.auto import partition
        return "\n\n".join(str(el) for el in partition(str(path)))
    elif parser == 'beautifulsoup':
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(path.read_text(errors='ignore'), 'html.parser')
        for s in soup(["script", "style"]):
            s.decompose()
        return soup.get_text(separator='\n')
    raise ValueError(f"Unknown parser: {parser}")


async def handle_document_parser(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Parse documents to text using configurable parsers."""
    start_time = time.time()

    try:
        files = parameters.get('files', [])
        input_dir = parameters.get('inputDir', '')
        parser = parameters.get('parser', 'pypdf')
        file_pattern = parameters.get('filePattern', '*.pdf')

        paths = []
        for f in files:
            p = f.get('path', '') if isinstance(f, dict) else str(f)
            if p:
                paths.append(Path(p))
        if input_dir and Path(input_dir).exists():
            paths.extend(Path(input_dir).glob(file_pattern))

        if not paths:
            return {
                "success": True, "node_id": node_id, "node_type": node_type,
                "result": {"documents": [], "parsed_count": 0, "failed": []},
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        logger.info("[documentParser] Starting", node_id=node_id, files=len(paths), parser=parser)
        documents, failed = [], []

        for path in paths:
            try:
                content = await asyncio.to_thread(_parse_file_sync, path, parser)
                documents.append({'source': str(path), 'filename': path.name,
                                 'content': content, 'length': len(content), 'parser': parser})
            except Exception as e:
                failed.append({'file': str(path), 'error': str(e)})

        return {
            "success": True, "node_id": node_id, "node_type": node_type,
            "result": {"documents": documents, "parsed_count": len(documents), "failed": failed},
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[documentParser] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# Text Chunker
# =============================================================================

async def handle_text_chunker(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Split text into overlapping chunks using LangChain splitters."""
    start_time = time.time()

    try:
        documents = parameters.get('documents', [])
        chunk_size = int(parameters.get('chunkSize', 1024))
        chunk_overlap = int(parameters.get('chunkOverlap', 200))
        strategy = parameters.get('strategy', 'recursive')

        if not documents:
            return {
                "success": True, "node_id": node_id, "node_type": node_type,
                "result": {"chunks": [], "chunk_count": 0},
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownTextSplitter

        if strategy == 'markdown':
            splitter = MarkdownTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        else:
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

        logger.info("[textChunker] Starting", node_id=node_id, docs=len(documents))
        chunks = []

        for doc in documents:
            content = doc.get('content', '') if isinstance(doc, dict) else str(doc)
            source = doc.get('source', 'input') if isinstance(doc, dict) else 'input'
            if not content:
                continue
            for i, chunk_text in enumerate(splitter.split_text(content)):
                chunks.append({'source': source, 'chunk_index': i,
                              'content': chunk_text, 'length': len(chunk_text)})

        return {
            "success": True, "node_id": node_id, "node_type": node_type,
            "result": {"chunks": chunks, "chunk_count": len(chunks)},
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[textChunker] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# Embedding Generator
# =============================================================================

async def handle_embedding_generator(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate embeddings using HuggingFace, OpenAI, or Ollama."""
    start_time = time.time()

    try:
        chunks = parameters.get('chunks', [])
        provider = parameters.get('provider', 'huggingface')
        model = parameters.get('model', 'BAAI/bge-small-en-v1.5')
        api_key = parameters.get('apiKey', '')

        if not chunks:
            return {
                "success": True, "node_id": node_id, "node_type": node_type,
                "result": {"embeddings": [], "embedding_count": 0, "dimensions": 0, "chunks": []},
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        texts = [c.get('content', '') if isinstance(c, dict) else str(c) for c in chunks]
        logger.info("[embeddingGenerator] Starting", node_id=node_id, texts=len(texts), provider=provider)

        if provider == 'huggingface':
            try:
                from langchain_huggingface import HuggingFaceEmbeddings
            except ImportError:
                raise ImportError("HuggingFace embeddings not available. Install with: pip install langchain-huggingface sentence-transformers")
            embedder = HuggingFaceEmbeddings(model_name=model)
        elif provider == 'openai':
            from langchain_openai import OpenAIEmbeddings
            embedder = OpenAIEmbeddings(model=model, api_key=api_key)
        elif provider == 'ollama':
            from langchain_ollama import OllamaEmbeddings
            embedder = OllamaEmbeddings(model=model)
        else:
            raise ValueError(f"Unknown provider: {provider}")

        embeddings = await asyncio.to_thread(embedder.embed_documents, texts)
        dimensions = len(embeddings[0]) if embeddings else 0

        return {
            "success": True, "node_id": node_id, "node_type": node_type,
            "result": {"embeddings": embeddings, "embedding_count": len(embeddings),
                      "dimensions": dimensions, "chunks": chunks, "provider": provider, "model": model},
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[embeddingGenerator] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# Vector Store
# =============================================================================

async def handle_vector_store(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Store or query vectors using ChromaDB, Qdrant, or Pinecone."""
    start_time = time.time()

    try:
        operation = parameters.get('operation', 'store')
        backend = parameters.get('backend', 'chroma')
        collection_name = parameters.get('collectionName', 'documents')

        logger.info("[vectorStore] Starting", node_id=node_id, op=operation, backend=backend)

        if backend == 'chroma':
            result = await _chroma_op(operation, parameters, collection_name)
        elif backend == 'qdrant':
            result = await _qdrant_op(operation, parameters, collection_name)
        elif backend == 'pinecone':
            result = await _pinecone_op(operation, parameters, collection_name)
        else:
            raise ValueError(f"Unknown backend: {backend}")

        result['backend'] = backend
        result['collection_name'] = collection_name

        return {
            "success": True, "node_id": node_id, "node_type": node_type,
            "result": result, "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[vectorStore] Failed", node_id=node_id, error=str(e))
        return {
            "success": False, "node_id": node_id, "node_type": node_type,
            "error": str(e), "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def _chroma_op(operation: str, params: Dict, collection: str) -> Dict:
    """ChromaDB operations."""
    try:
        import chromadb
    except ImportError:
        raise ImportError("ChromaDB not available. Install with: pip install chromadb")
    import uuid

    persist_dir = params.get('persistDir', './data/vectors')
    client = chromadb.PersistentClient(path=persist_dir)
    coll = client.get_or_create_collection(name=collection)

    if operation == 'store':
        embeddings = params.get('embeddings', [])
        chunks = params.get('chunks', [])
        if not embeddings:
            return {"stored_count": 0, "collection_count": coll.count()}
        ids = [str(uuid.uuid4()) for _ in embeddings]
        docs = [c.get('content', '') if isinstance(c, dict) else str(c) for c in chunks]
        while len(docs) < len(embeddings):
            docs.append('')
        metas = [{'source': c.get('source', 'unknown'), 'chunk_index': c.get('chunk_index', i)}
                 if isinstance(c, dict) else {'source': 'input', 'chunk_index': i}
                 for i, c in enumerate(chunks)]
        while len(metas) < len(embeddings):
            metas.append({'source': 'unknown', 'chunk_index': len(metas)})
        await asyncio.to_thread(coll.add, ids=ids, embeddings=embeddings, documents=docs, metadatas=metas)
        return {"stored_count": len(embeddings), "collection_count": coll.count()}

    elif operation == 'query':
        query_emb = params.get('queryEmbedding', [])
        top_k = int(params.get('topK', 5))
        if not query_emb:
            return {"matches": []}
        results = coll.query(query_embeddings=[query_emb], n_results=top_k)
        matches = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                matches.append({
                    'id': results['ids'][0][i],
                    'document': results['documents'][0][i] if results['documents'] else '',
                    'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                    'distance': results['distances'][0][i] if results.get('distances') else None
                })
        return {"matches": matches}

    elif operation == 'delete':
        ids = params.get('ids', [])
        if ids:
            await asyncio.to_thread(coll.delete, ids=ids)
        return {"deleted": True, "count": len(ids)}

    return {}


async def _qdrant_op(operation: str, params: Dict, collection: str) -> Dict:
    """Qdrant operations."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import VectorParams, Distance, PointStruct
    except ImportError:
        raise ImportError("Qdrant client not available. Install with: pip install qdrant-client")
    import uuid

    url = params.get('qdrantUrl', 'http://localhost:6333')
    client = QdrantClient(url=url)

    if operation == 'store':
        embeddings = params.get('embeddings', [])
        chunks = params.get('chunks', [])
        if not embeddings:
            return {"stored_count": 0}
        vec_size = len(embeddings[0])
        colls = client.get_collections().collections
        if collection not in [c.name for c in colls]:
            client.create_collection(collection, vectors_config=VectorParams(size=vec_size, distance=Distance.COSINE))
        points = []
        for i, emb in enumerate(embeddings):
            payload = {}
            if i < len(chunks):
                c = chunks[i]
                if isinstance(c, dict):
                    payload = {'content': c.get('content', ''), 'source': c.get('source', 'unknown'),
                              'chunk_index': c.get('chunk_index', i)}
                else:
                    payload = {'content': str(c), 'source': 'input', 'chunk_index': i}
            points.append(PointStruct(id=str(uuid.uuid4()), vector=emb, payload=payload))
        await asyncio.to_thread(client.upsert, collection_name=collection, points=points)
        return {"stored_count": len(embeddings)}

    elif operation == 'query':
        query_emb = params.get('queryEmbedding', [])
        top_k = int(params.get('topK', 5))
        if not query_emb:
            return {"matches": []}
        results = await asyncio.to_thread(client.search, collection_name=collection,
                                          query_vector=query_emb, limit=top_k)
        return {"matches": [{'id': str(r.id), 'document': r.payload.get('content', ''),
                            'metadata': r.payload, 'score': r.score} for r in results]}

    elif operation == 'delete':
        ids = params.get('ids', [])
        if ids:
            await asyncio.to_thread(client.delete, collection_name=collection, points_selector=ids)
        return {"deleted": True, "count": len(ids)}

    return {}


async def _pinecone_op(operation: str, params: Dict, collection: str) -> Dict:
    """Pinecone operations."""
    from pinecone import Pinecone
    import uuid

    api_key = params.get('pineconeApiKey', '')
    if not api_key:
        raise ValueError("Pinecone API key required")

    pc = Pinecone(api_key=api_key)
    index = pc.Index(collection)

    if operation == 'store':
        embeddings = params.get('embeddings', [])
        chunks = params.get('chunks', [])
        if not embeddings:
            return {"stored_count": 0}
        vectors = []
        for i, emb in enumerate(embeddings):
            meta = {}
            if i < len(chunks):
                c = chunks[i]
                if isinstance(c, dict):
                    meta = {'content': c.get('content', ''), 'source': c.get('source', 'unknown'),
                           'chunk_index': c.get('chunk_index', i)}
                else:
                    meta = {'content': str(c), 'source': 'input', 'chunk_index': i}
            vectors.append({'id': str(uuid.uuid4()), 'values': emb, 'metadata': meta})
        await asyncio.to_thread(index.upsert, vectors=vectors)
        return {"stored_count": len(embeddings)}

    elif operation == 'query':
        query_emb = params.get('queryEmbedding', [])
        top_k = int(params.get('topK', 5))
        if not query_emb:
            return {"matches": []}
        results = await asyncio.to_thread(index.query, vector=query_emb, top_k=top_k, include_metadata=True)
        return {"matches": [{'id': m.id, 'document': m.metadata.get('content', '') if m.metadata else '',
                            'metadata': m.metadata or {}, 'score': m.score} for m in results.matches]}

    elif operation == 'delete':
        ids = params.get('ids', [])
        if ids:
            await asyncio.to_thread(index.delete, ids=ids)
        return {"deleted": True, "count": len(ids)}

    return {}
