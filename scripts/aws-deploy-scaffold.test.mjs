/**
 * AWS deploy scaffolding for bisync.ai must stay present.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'docs/AWS_DEPLOY.md',
  'docs/AWS_TARGET_ARCHITECTURE.md',
  'docs/AWS_MIGRATION_READINESS.md',
  'infra/aws/versions.tf',
  'infra/aws/ecs.tf',
  'infra/aws/rds.tf',
  'infra/aws/alb_dns.tf',
  'infra/aws/github_oidc.tf',
  'infra/aws/terraform.tfvars.example',
  '.github/workflows/deploy-aws.yml',
  'scripts/setup-github-aws-deploy.sh',
];

for (const rel of required) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const wf = fs.readFileSync(path.join(root, '.github/workflows/deploy-aws.yml'), 'utf8');
assert.match(wf, /name:\s*Deploy AWS/, 'workflow name');
assert.match(wf, /workflow_dispatch/, 'manual dispatch for first cutover');
assert.match(wf, /aws-actions\/configure-aws-credentials/, 'OIDC login');

const deploy = fs.readFileSync(path.join(root, 'docs/AWS_DEPLOY.md'), 'utf8');
assert.match(deploy, /bisync\.ai/, 'deploy doc targets bisync.ai');
assert.match(deploy, /ap-southeast-1/, 'Singapore region');

console.log('aws-deploy-scaffold.test.mjs: ok');
