// Document Processing Nodes - HTTP Scraper, File Downloader, Document Parser, Text Chunker, Embedding Generator, Vector Store
import { INodeTypeDescription, NodeConnectionType } from '../types/INodeProperties';

export const documentNodes: Record<string, INodeTypeDescription> = {
  httpScraper: {
    displayName: 'HTTP Scraper',
    name: 'httpScraper',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  fileDownloader: {
    displayName: 'File Downloader',
    name: 'fileDownloader',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  documentParser: {
    displayName: 'Document Parser',
    name: 'documentParser',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  textChunker: {
    displayName: 'Text Chunker',
    name: 'textChunker',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  embeddingGenerator: {
    displayName: 'Embedding Generator',
    name: 'embeddingGenerator',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
  },

  vectorStore: {
    displayName: 'Vector Store',
    name: 'vectorStore',
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
    // Wave 8: schema lives on backend (see server/models/nodes.py).
    properties: [],
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
