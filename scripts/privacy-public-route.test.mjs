/**
 * Public legal short URLs must resolve in AppRoot (store / marketing listings use /privacy).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = fs.readFileSync(path.join(root, 'client/src/AppRoot.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/Bisync.Api/Controllers/AuthController.cs'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'client/src/data/legalShared.ts'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'client/src/data/privacyPolicy.ts'), 'utf8');

assert.match(appRoot, /\/\(legal\\\/\)\?privacy/, 'AppRoot must accept /privacy');
assert.match(appRoot, /\/\(legal\\\/\)\?eula/, 'AppRoot must accept /eula');
assert.match(appRoot, /\/\(legal\\\/\)\?dpa/, 'AppRoot must accept /dpa');
assert.match(auth, /url = "\/privacy"/, 'Auth legal metadata must publish /privacy');
assert.match(shared, /privacy: '\/privacy'/, 'LEGAL_PUBLIC_PATHS.privacy must be /privacy');
assert.match(shared, /support@bisync\.cloud/, 'Privacy contact email must be support@bisync.cloud');
assert.match(privacy, /LEGAL_CONTACT_EMAIL/, 'Privacy contact must include email');

console.log('privacy-public-route.test.mjs: ok');
