// Document Processing Nodes - HTTP Scraper, File Downloader, Document Parser, Text Chunker, Embedding Generator, Vector Store
import {
  INodeTypeDescription,
  NodeConnectionType
} from '../types/INodeProperties';

export const documentNodes: Record<string, INodeTypeDescription> = {
  httpScraper: {
    displayName: 'HTTP Scraper',
    name: 'httpScraper',
    icon: '🔍',
    group: ['document'],
    version: 1,
    description: 'Scrape links from web pages with date/page pagination support',
    defaults: { name: 'HTTP Scraper', color: '#DC2626' },
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' as NodeConnectionType, description: 'Trigger input' }],
    outputs: [{
      name: 'main',
      displayName: 'Items',
      type: 'main' as NodeConnectionType,
      description: 'items, item_count, errors'
    }],
    properties: [
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com/api?date={date}',
        description: 'URL with optional placeholders: {date}, {page}'
      },
      {
        displayName: 'Iteration Mode',
        name: 'iterationMode',
        type: 'options',
        default: 'single',
        options: [
          { name: 'Single Request', value: 'single' },
          { name: 'Date Range', value: 'date' },
          { name: 'Page Pagination', value: 'page' }
        ]
      },
      {
        displayName: 'Start Date',
        name: 'startDate',
        type: 'string',
        default: '',
        placeholder: 'YYYY-MM-DD',
        displayOptions: { show: { iterationMode: ['date'] } }
      },
      {
        displayName: 'End Date',
        name: 'endDate',
        type: 'string',
        default: '',
        placeholder: 'YYYY-MM-DD',
        displayOptions: { show: { iterationMode: ['date'] } }
      },
      {
        displayName: 'Date Placeholder',
        name: 'datePlaceholder',
        type: 'string',
        default: '{date}',
        displayOptions: { show: { iterationMode: ['date'] } }
      },
      {
        displayName: 'Start Page',
        name: 'startPage',
        type: 'number',
        default: 1,
        displayOptions: { show: { iterationMode: ['page'] } }
      },
      {
        displayName: 'End Page',
        name: 'endPage',
        type: 'number',
        default: 10,
        displayOptions: { show: { iterationMode: ['page'] } }
      },
      {
        displayName: 'Link Selector',
        name: 'linkSelector',
        type: 'string',
        default: 'a[href$=".pdf"]',
        description: 'CSS selector for extracting links'
      },
      {
        displayName: 'Headers (JSON)',
        name: 'headers',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 2 },
        placeholder: '{"Authorization": "Bearer token"}'
      },
      {
        displayName: 'Use Proxy',
        name: 'useProxy',
        type: 'boolean',
        default: false,
        description: 'Route requests through a configured proxy provider'
      },
      {
        displayName: 'Proxy Country',
        name: 'proxyCountry',
        type: 'string',
        default: '',
        placeholder: 'US',
        description: 'ISO country code for geo-targeting (e.g. US, GB, DE)',
        displayOptions: { show: { useProxy: [true] } }
      },
      {
        displayName: 'Proxy Provider',
        name: 'proxyProvider',
        type: 'string',
        default: '',
        placeholder: 'Auto-select',
        description: 'Specific provider name, or leave empty for auto-selection',
        displayOptions: { show: { useProxy: [true] } }
      }
    ]
  },

  fileDownloader: {
    displayName: 'File Downloader',
    name: 'fileDownloader',
    icon: '⬇️',
    group: ['document'],
    version: 1,
    description: 'Download files from URLs in parallel',
    defaults: { name: 'Downloader', color: '#2563EB' },
    inputs: [{ name: 'main', displayName: 'Items', type: 'main' as NodeConnectionType, description: 'Array of items with url field' }],
    outputs: [{
      name: 'main',
      displayName: 'Files',
      type: 'main' as NodeConnectionType,
      description: 'downloaded, skipped, failed, files, output_dir'
    }],
    properties: [
      {
        displayName: 'Output Directory',
        name: 'outputDir',
        type: 'string',
        default: './data/downloads',
        description: 'Directory to save downloaded files'
      },
      {
        displayName: 'Max Workers',
        name: 'maxWorkers',
        type: 'number',
        default: 8,
        typeOptions: { minValue: 1, maxValue: 32 },
        description: 'Number of parallel download workers'
      },
      {
        displayName: 'Skip Existing',
        name: 'skipExisting',
        type: 'boolean',
        default: true,
        description: 'Skip files that already exist'
      },
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 60,
        typeOptions: { minValue: 10, maxValue: 600 }
      }
    ]
  },

  documentParser: {
    displayName: 'Document Parser',
    name: 'documentParser',
    icon: '📄',
    group: ['document'],
    version: 1,
    description: 'Parse documents to text using various parsers',
    defaults: { name: 'Parser', color: '#059669' },
    inputs: [{ name: 'main', displayName: 'Files', type: 'main' as NodeConnectionType, description: 'Array of files with path field' }],
    outputs: [{
      name: 'main',
      displayName: 'Documents',
      type: 'main' as NodeConnectionType,
      description: 'documents, parsed_count, failed'
    }],
    properties: [
      {
        displayName: 'Parser',
        name: 'parser',
        type: 'options',
        default: 'pypdf',
        options: [
          { name: 'PyPDF (Fast)', value: 'pypdf' },
          { name: 'Marker (GPU OCR)', value: 'marker' },
          { name: 'Unstructured (Multi-format)', value: 'unstructured' },
          { name: 'BeautifulSoup (HTML)', value: 'beautifulsoup' }
        ]
      },
      {
        displayName: 'Input Directory',
        name: 'inputDir',
        type: 'string',
        default: '',
        description: 'Directory to scan for files (optional, in addition to input)'
      },
      {
        displayName: 'File Pattern',
        name: 'filePattern',
        type: 'string',
        default: '*.pdf',
        description: 'Glob pattern for files in inputDir'
      }
    ]
  },

  textChunker: {
    displayName: 'Text Chunker',
    name: 'textChunker',
    icon: '✂️',
    group: ['document'],
    version: 1,
    description: 'Split text into overlapping chunks for embedding',
    defaults: { name: 'Chunker', color: '#7C3AED' },
    inputs: [{ name: 'main', displayName: 'Documents', type: 'main' as NodeConnectionType, description: 'Array of documents with content field' }],
    outputs: [{
      name: 'main',
      displayName: 'Chunks',
      type: 'main' as NodeConnectionType,
      description: 'chunks, chunk_count'
    }],
    properties: [
      {
        displayName: 'Chunk Size',
        name: 'chunkSize',
        type: 'number',
        default: 1024,
        typeOptions: { minValue: 100, maxValue: 8000 },
        description: 'Target size of each chunk in characters'
      },
      {
        displayName: 'Chunk Overlap',
        name: 'chunkOverlap',
        type: 'number',
        default: 200,
        typeOptions: { minValue: 0, maxValue: 1000 },
        description: 'Number of overlapping characters between chunks'
      },
      {
        displayName: 'Strategy',
        name: 'strategy',
        type: 'options',
        default: 'recursive',
        options: [
          { name: 'Recursive (Recommended)', value: 'recursive' },
          { name: 'Markdown', value: 'markdown' },
          { name: 'Token', value: 'token' }
        ]
      }
    ]
  },

  embeddingGenerator: {
    displayName: 'Embedding Generator',
    name: 'embeddingGenerator',
    icon: '🧠',
    group: ['document'],
    version: 1,
    description: 'Generate vector embeddings from text chunks',
    defaults: { name: 'Embedder', color: '#F59E0B' },
    inputs: [{ name: 'main', displayName: 'Chunks', type: 'main' as NodeConnectionType, description: 'Array of chunks with content field' }],
    outputs: [{
      name: 'main',
      displayName: 'Embeddings',
      type: 'main' as NodeConnectionType,
      description: 'embeddings, embedding_count, dimensions, chunks'
    }],
    properties: [
      {
        displayName: 'Provider',
        name: 'provider',
        type: 'options',
        default: 'huggingface',
        options: [
          { name: 'HuggingFace (Local)', value: 'huggingface' },
          { name: 'OpenAI', value: 'openai' },
          { name: 'Ollama (Local)', value: 'ollama' }
        ]
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: 'BAAI/bge-small-en-v1.5',
        description: 'Embedding model name'
      },
      {
        displayName: 'Batch Size',
        name: 'batchSize',
        type: 'number',
        default: 32,
        typeOptions: { minValue: 1, maxValue: 256 }
      },
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        default: '',
        typeOptions: { password: true },
        displayOptions: { show: { provider: ['openai'] } },
        description: 'OpenAI API key (if using OpenAI provider)'
      }
    ]
  },

  vectorStore: {
    displayName: 'Vector Store',
    name: 'vectorStore',
    icon: '🗄️',
    group: ['document'],
    version: 1,
    description: 'Store and query vector embeddings',
    defaults: { name: 'Vector Store', color: '#8B5CF6' },
    inputs: [{ name: 'main', displayName: 'Embeddings', type: 'main' as NodeConnectionType, description: 'Array of embeddings or query embedding' }],
    outputs: [{
      name: 'main',
      displayName: 'Result',
      type: 'main' as NodeConnectionType,
      description: 'stored_count/matches, collection_name, backend'
    }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: 'store',
        options: [
          { name: 'Store', value: 'store' },
          { name: 'Query', value: 'query' },
          { name: 'Delete', value: 'delete' }
        ]
      },
      {
        displayName: 'Backend',
        name: 'backend',
        type: 'options',
        default: 'chroma',
        options: [
          { name: 'ChromaDB (Local)', value: 'chroma' },
          { name: 'Qdrant (Production)', value: 'qdrant' },
          { name: 'Pinecone (Cloud)', value: 'pinecone' }
        ]
      },
      {
        displayName: 'Collection Name',
        name: 'collectionName',
        type: 'string',
        default: 'documents',
        description: 'Name of the vector collection'
      },
      {
        displayName: 'Persist Directory',
        name: 'persistDir',
        type: 'string',
        default: './data/vectors',
        displayOptions: { show: { backend: ['chroma'] } },
        description: 'Directory to persist ChromaDB data'
      },
      {
        displayName: 'Qdrant URL',
        name: 'qdrantUrl',
        type: 'string',
        default: 'http://localhost:6333',
        displayOptions: { show: { backend: ['qdrant'] } }
      },
      {
        displayName: 'Pinecone API Key',
        name: 'pineconeApiKey',
        type: 'string',
        default: '',
        typeOptions: { password: true },
        displayOptions: { show: { backend: ['pinecone'] } }
      },
      {
        displayName: 'Top K',
        name: 'topK',
        type: 'number',
        default: 5,
        typeOptions: { minValue: 1, maxValue: 100 },
        displayOptions: { show: { operation: ['query'] } },
        description: 'Number of results to return for queries'
      }
    ]
  }
};

export const DOCUMENT_NODE_TYPES = [
  'httpScraper',
  'fileDownloader',
  'documentParser',
  'textChunker',
  'embeddingGenerator',
  'vectorStore'
];
