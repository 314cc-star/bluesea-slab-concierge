import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converse } from '../server/concierge.js';

test('cards match the slabs named in the reply, not the first search results', async () => {
  const responses = [
    { parts: [{ functionCall: { name: 'search_slabs', args: { min_length_cm: 230 } } }] },
    { parts: [{ text: 'Try BSW-177, BSW-176 and BSW-132.' }] },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: responses.shift() }] }) });
  try {
    const result = await converse({ history: [], message: 'Find a slab', depositRate: 0.5 });
    assert.deepEqual(result.suggestedSlabIds, ['BSW-177', 'BSW-176', 'BSW-132']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
