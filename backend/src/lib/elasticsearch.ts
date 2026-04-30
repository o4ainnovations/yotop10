import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

export const es = new ElasticsearchClient({ node: esUrl });
