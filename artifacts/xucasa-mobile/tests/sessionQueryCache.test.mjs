import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import sessionQueryCache from '../lib/sessionQueryCache.ts';

const {
  clearSessionQueryCache,
  getUserScopedQueryKey,
} = sessionQueryCache;

const queryClient = new QueryClient();
const ownProfileKey = ['/api/agent/public-profile'];
const agentAKey = getUserScopedQueryKey(ownProfileKey, 'agent-a');
const agentBKey = getUserScopedQueryKey(ownProfileKey, 'agent-b');

queryClient.setQueryData(agentAKey, {
  userId: 'agent-a',
  emailOverride: 'private-agent-a@example.test',
});

assert.equal(queryClient.getQueryData(agentBKey), undefined);

await clearSessionQueryCache(queryClient);

assert.equal(queryClient.getQueryData(agentAKey), undefined);
assert.equal(queryClient.getQueryData(agentBKey), undefined);

queryClient.setQueryData(agentBKey, {
  userId: 'agent-b',
  emailOverride: 'private-agent-b@example.test',
});

assert.equal(queryClient.getQueryData(agentAKey), undefined);
assert.equal(queryClient.getQueryData(agentBKey).userId, 'agent-b');

console.log('✓ account switches isolate and clear editable agent-profile data');