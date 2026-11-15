const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { scanText, redactLocalPaths, evaluateAudit } = require('../scan_git_security');

const privateKey = 'a'.repeat(64);
const fingerprint = crypto.createHash('sha256').update(privateKey).digest('hex');
const token = 'ghp_' + 'A'.repeat(36);
const pemMarker = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const slash = String.fromCharCode(92);
const windowsPath = 'C:' + slash + 'Users' + slash + 'example' + slash + 'repo' + slash + 'secret.txt';
const fileUri = 'file:///' + 'E:' + '/workspace/project/file.py';

const findings = scanText([token, pemMarker, '0x' + privateKey, windowsPath].join('\n'), {
  privateKeyFingerprint: fingerprint,
  includePaths: true
});
assert(findings.includes('GITHUB_TOKEN_MATCH'));
assert(findings.includes('PRIVATE_KEY_PEM_MATCH'));
assert(findings.includes('TEST_WALLET_PRIVATE_KEY_MATCH'));
assert(findings.includes('LOCAL_ABSOLUTE_PATH_MATCH'));

const clean = scanText('public transaction hash: 0x' + '1'.repeat(64), {
  privateKeyFingerprint: fingerprint,
  includePaths: true
});
assert.deepEqual(clean, []);

const redacted = redactLocalPaths(windowsPath + '\n' + fileUri);
assert(!/[A-Za-z]:[\\/]/.test(redacted));
assert(!/file:\/\/\/[A-Za-z]:/i.test(redacted));
assert(redacted.includes('[LOCAL_PATH_REDACTED]'));

assert.equal(evaluateAudit([], [{ pass: true }, { pass: true }]), 'PASS');
assert.equal(evaluateAudit([{ type: 'TOKEN' }], [{ pass: true }]), 'FAIL');
assert.equal(evaluateAudit([], [{ pass: false }]), 'FAIL');

console.log('Security scanner unit tests: PASS');
