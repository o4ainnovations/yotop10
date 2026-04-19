import request from 'supertest';
import app from '../src/server';

test('admin routes are protected', async () => {
  const response = await request(app).get('/api/admin/posts/pending');
  expect(response.status).toBe(401);
});

test('all declared routes are mounted', async () => {
  const ROUTE_ORDER = require('../src/server').ROUTE_ORDER;
  
  for (const routeName of ROUTE_ORDER) {
    // Use OPTIONS method works for all HTTP verbs
    const response = await request(app).options(`/api/${routeName}`);
    
    // Valid statuses mean route exists and is mounted correctly
    expect(response.status).not.toBeOneOf([404, 405]);
    expect(response.status).toBeLessThan(500);
  }
});

test('routes are mounted in correct order', async () => {
  const stack = app._router.stack.filter(r => r.regexp && r.handle.name !== 'query' && r.handle.name !== 'expressInit');
  const order = stack.map(r => r.regexp.source);
  
  expect(order.indexOf('admin')).toBeGreaterThan(order.indexOf('posts'));
  expect(order.indexOf('admin')).toBeGreaterThan(order.indexOf('users'));
});
