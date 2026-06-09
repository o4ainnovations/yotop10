import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

const ES_HOST = process.env.ES_HOST || 'elasticsearch';
const ES_PORT = parseInt(process.env.ES_PORT || '9200', 10);
const ES_PASSWORD = process.env.ES_PASSWORD || '';

const esUrl = `http://${ES_HOST}:${ES_PORT}`;

const clientConfig: { node: string; auth?: { username: string; password: string }; requestTimeout: number; maxRetries: number } = {
  node: esUrl,
  requestTimeout: 30000,
  maxRetries: 3,
};

if (ES_PASSWORD) {
  clientConfig.auth = { username: 'elastic', password: ES_PASSWORD };
  console.log('[Elasticsearch] Client configured with authentication');
} else {
  console.warn('[Elasticsearch] Client configured WITHOUT authentication');
}

export const es = new ElasticsearchClient(clientConfig);
