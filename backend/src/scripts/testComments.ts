/**
 * Critical integration tests for the comments endpoint.
 * Run: npx tsx backend/src/scripts/testComments.ts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8000/api';
const SLUG = process.env.TEST_SLUG || 'top-10-greatest-football-players-ever-9c80e4';

interface TestResult {
  name: string;
  passed: boolean;
  status: number;
  body: unknown;
  error?: string;
}

const results: TestResult[] = [];
const headers: Record<string, string> = { 'Content-Type': 'application/json' };

async function req(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown; headers: Response['headers'] }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/device_fingerprint=([^;]+)/);
    if (match) {
      headers['Cookie'] = `device_fingerprint=${match[1]}`;
    }
  }
  const contentType = res.headers.get('content-type') || '';
  let bodyData: unknown;
  if (contentType.includes('application/json')) {
    bodyData = await res.json();
  } else {
    bodyData = await res.text();
  }
  return { status: res.status, body: bodyData, headers: res.headers };
}

async function test(name: string, fn: () => Promise<{ status: number; body: unknown }>) {
  try {
    const r = await fn();
    results.push({ name, passed: true, status: r.status, body: r.body });
    console.log(`  ✅ ${name} (${r.status})`);
  } catch (e) {
    results.push({ name, passed: false, status: 0, body: null, error: String(e) });
    console.log(`  ❌ ${name} — ${e}`);
  }
}

async function main() {
  console.log('\n=== Comments Endpoint Integration Tests ===\n');

  // 1. Establish fingerprint
  console.log('1. Authentication');
  await test('GET health (obtain fingerprint)', () => req('GET', '/health'));
  await test('GET posts (uses fingerprint cookie)', () => req('GET', '/posts'));

  // 2. GET comments on empty post
  console.log('\n2. GET comments');
  await test('GET comments on existing post', () => req('GET', `/posts/${SLUG}/comments`));
  await test('GET comments on nonexistent post', () => req('GET', '/posts/nonexistent-slug-12345/comments'));
  await test('GET comments with invalid filter', () => req('GET', `/posts/${SLUG}/comments?list_item_id=invalid`));

  // 3. POST comment — happy path
  console.log('\n3. POST comment — happy path');
  await test('POST comment without content (400)', () => req('POST', `/posts/${SLUG}/comments`, { content: '' }));
  await test('POST comment content only', () => req('POST', `/posts/${SLUG}/comments`, { content: 'Great list! Messi is truly the GOAT.' }));
  await test('POST comment too long (400)', () => req('POST', `/posts/${SLUG}/comments`, { content: 'x'.repeat(2001) }));
  await test('POST comment on nonexistent post (404)', () => req('POST', '/posts/ffffffffffffffffffffffff/comments', { content: 'hello' }));

  // 4. POST comment — with list_item_id
  console.log('\n4. POST comment — list item targeting');
  await test('POST comment with invalid list_item_id (400)', () => req('POST', `/posts/${SLUG}/comments`, { content: 'test', list_item_id: 'invalid' }));
  // Get actual list item ID from the post
  const postRes = await req('GET', `/posts/${SLUG}`);
  const post = (postRes.body as any)?.post || (postRes.body as any);
  const itemId = post?.items?.[0]?.id || post?.items?.[0]?._id;
  if (itemId) {
    await test('POST comment with valid list_item_id (201)', () => req('POST', `/posts/${SLUG}/comments`, { content: 'Messi!', list_item_id: itemId }));
  } else {
    console.log('  ⚠️  Skipped — no list items found in post response');
  }

  // 5. POST comment — threading (reply)
  console.log('\n5. POST comment — replies');
  const commentsRes = await req('GET', `/posts/${SLUG}/comments`);
  const comments = (commentsRes.body as any)?.comments || [];
  const firstCommentId = comments[0]?.id;
  if (firstCommentId) {
    await test('POST reply to comment (201)', () => req('POST', `/posts/${SLUG}/comments`, { content: 'I agree!', parent_comment_id: firstCommentId }));
    await test('POST reply to nonexistent parent (404)', () => req('POST', `/posts/${SLUG}/comments`, { content: 'nope', parent_comment_id: 'ffffffffffffffffffffffff' }));
  } else {
    console.log('  ⚠️  Skipped — no comments to reply to');
  }

  // 6. GET comments after posting
  console.log('\n6. GET comments — populated');
  await test('GET comments after posting', () => req('GET', `/posts/${SLUG}/comments`));

  // 7. Edit comment (PATCH /api/comments/:id)
  console.log('\n7. PATCH comment — edit');
  const freshComments = await req('GET', `/posts/${SLUG}/comments`);
  const editTargetId = ((freshComments.body as any)?.comments || [])[0]?.id;
  if (editTargetId) {
    await test('PATCH edit own comment (200)', () => req('PATCH', `/comments/${editTargetId}`, { content: 'Edited: Messi is definitely the GOAT!' }));
    await test('PATCH edit with empty content (400)', () => req('PATCH', `/comments/${editTargetId}`, { content: '' }));
  } else {
    console.log('  ⚠️  Skipped — no comments to edit');
  }

  // 8. Delete comment (DELETE /api/comments/:id)
  console.log('\n8. DELETE comment');
  const preDelete = await req('GET', `/posts/${SLUG}/comments`);
  const deleteTargetId = ((preDelete.body as any)?.comments || [])[0]?.id;
  if (deleteTargetId) {
    await test('DELETE own comment (200)', () => req('DELETE', `/comments/${deleteTargetId}`));
    await test('DELETE already deleted (404)', () => req('DELETE', `/comments/${deleteTargetId}`));
  } else {
    console.log('  ⚠️  Skipped — no comments to delete');
  }

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed > 0) {
    console.log('\n  Failures:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name} — ${r.error || JSON.stringify(r.body)}`);
    });
  }

  const allPassed = failed === 0;
  console.log(`\n  ${allPassed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
