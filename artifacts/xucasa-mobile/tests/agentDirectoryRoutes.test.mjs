import assert from 'node:assert/strict';
import routes from '../lib/agentDirectoryRoutes.ts';

const { agentProfileRoute, agentPropertyRoute } = routes;

assert.equal(agentProfileRoute('agent/id with spaces'), '/agents/agent%2Fid%20with%20spaces');

const currentListing = { id: 101, status: 'active' };
const historicalSale = { id: 202, status: 'sold' };
assert.equal(agentPropertyRoute(currentListing.id), '/property/101');
assert.equal(agentPropertyRoute(historicalSale.id), '/property/202');

console.log('✓ directory profiles and all property periods use native routes');