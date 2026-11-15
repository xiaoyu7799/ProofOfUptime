const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const repoDir = path.resolve(__dirname);
const secretWalletPath = path.join(repoDir, '.secrets', 'wallet.json');
const tokenRegex = /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/;
const pemRegex = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const privateKeyHexRegex = /(?:0x)?[a-f0-9]{64}/gi;
const localPathRegex = /(?:file:\/\/\/)?\b[A-Za-z]:[\\/][^\s"'<>|)]*|(?:\/Users\/|\/home\/|\/mnt\/|\/tmp\/)[^\s"'<>|)]*/i;

function scanText(content, options = {}) {
  const text = String(content);
  const issues = [];
  if (tokenRegex.test(text)) issues.push('GITHUB_TOKEN_MATCH');
  if (pemRegex.test(text)) issues.push('PRIVATE_KEY_PEM_MATCH');
  if (options.includePaths && localPathRegex.test(text)) issues.push('LOCAL_ABSOLUTE_PATH_MATCH');
  if (options.privateKeyFingerprint) {
    const matches = text.match(privateKeyHexRegex) || [];
    const found = matches.some(value =>
      crypto.createHash('sha256')
        .update(value.replace(/^0x/i, '').toLowerCase())
        .digest('hex') === options.privateKeyFingerprint
    );
    if (found) issues.push('TEST_WALLET_PRIVATE_KEY_MATCH');
  }
  return issues;
}

function redactLocalPaths(content) {
  return String(content)
    .replace(/file:\/\/\/[A-Za-z]:[\\/][^\s"'<>|)]*/gi, '[LOCAL_FILE_URI_REDACTED]')
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>|)]*/gi, '[LOCAL_PATH_REDACTED]')
    .replace(/(?:\/Users\/|\/home\/|\/mnt\/|\/tmp\/)[^\s"'<>|)]*/g, '[LOCAL_PATH_REDACTED]');
}

function evaluateAudit(issues, ignoreChecks) {
  return issues.length === 0 && ignoreChecks.every(item => item.pass) ? 'PASS' : 'FAIL';
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    ...options
  }).trimEnd();
}

function checkIgnored(samplePath) {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '-q', samplePath], {
      cwd: repoDir,
      stdio: 'ignore'
    });
    return true;
  } catch (_) {
    return false;
  }
}

function runAudit() {
  const currentHeadSha = git(['rev-parse', 'HEAD']);
  const rawHistory = git(['log', '-p', '--all']);
  const historySummary = git(['log', '--all', '--date=iso-strict', '--format=commit %H%nAuthor: %an <%ae>%nDate: %ad%n    %s', '--stat']);
  const sanitizedHistory = redactLocalPaths(historySummary);
  const historyPath = path.join(repoDir, 'audit-package', 'git_history.txt');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, sanitizedHistory + '\n', 'utf8');

  let privateKeyFingerprint = null;
  let walletStatus = 'SKIPPED (LOCAL WALLET ABSENT)';
  const preliminaryIssues = [];
  if (fs.existsSync(secretWalletPath)) {
    try {
      const wallet = JSON.parse(fs.readFileSync(secretWalletPath, 'utf8'));
      const key = String(wallet && wallet.privateKey || '').replace(/^0x/i, '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('privateKey must be 32-byte hex');
      privateKeyFingerprint = crypto.createHash('sha256').update(key).digest('hex');
      walletStatus = 'VERIFIED (FINGERPRINT CHECK ENABLED)';
    } catch (error) {
      walletStatus = 'FAIL (WALLET FILE INVALID)';
      preliminaryIssues.push({ file: '.secrets/wallet.json', type: 'WALLET_FILE_INVALID' });
    }
  }

  const trackedFiles = git(['ls-files', '--cached', '--others', '--exclude-standard'])
    .split('\n').filter(Boolean);
  const workspaceIssues = [];
  for (const relPath of trackedFiles) {
    const fullPath = path.join(repoDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const type of scanText(content, { privateKeyFingerprint, includePaths: true })) {
        workspaceIssues.push({ file: relPath, type });
      }
    } catch (error) {
      workspaceIssues.push({ file: relPath, type: 'FILE_READ_ERROR' });
    }
  }

  const historyIssues = scanText(rawHistory, { privateKeyFingerprint, includePaths: false })
    .map(type => ({ type }));
  const requiredIgnorePaths = [
    '.secrets/wallet.json',
    'private.key',
    'private.pem',
    '.env',
    '.env.local',
    '__pycache__/module.pyc',
    'module.pyc',
    'node_modules/example/index.js',
    'FINAL_DELIVERY_SUMMARY.md'
  ];
  const ignoreChecks = requiredIgnorePaths.map(samplePath => ({
    path: samplePath,
    pass: checkIgnored(samplePath)
  }));
  const allIssues = [...preliminaryIssues, ...workspaceIssues, ...historyIssues];
  const status = evaluateAudit(allIssues, ignoreChecks);
  const walletFingerprintLeak = allIssues.some(item => item.type === 'TEST_WALLET_PRIVATE_KEY_MATCH');
  const walletCheckResult = walletStatus.startsWith('FAIL') || walletFingerprintLeak
    ? 'FAIL'
    : walletStatus.startsWith('SKIPPED') ? 'SKIPPED' : 'PASS';
  const originUrl = (() => {
    try { return git(['remote', 'get-url', 'origin']); }
    catch (_) { return 'NOT_CONFIGURED'; }
  })();
  const commitCount = git(['rev-list', '--count', '--all']);
  const issueLines = allIssues.length
    ? allIssues.map(item => '- ' + (item.file ? item.file + ': ' : '') + item.type)
    : ['- None'];
  const report = [
    '# Git Repository Security Audit',
    '',
    '**Generated at**: ' + new Date().toISOString(),
    '**Audit HEAD**: ' + currentHeadSha + '  ',
    '**Workspace files scanned**: ' + trackedFiles.length + '  ',
    '**Git commits included in secret scan**: ' + commitCount + '  ',
    '**Overall result**: **' + status + '**',
    '',
    '## Scan results',
    '',
    '| Check | Result | Detail |',
    '| :--- | :---: | :--- |',
    '| GitHub tokens | ' + (allIssues.some(x => x.type === 'GITHUB_TOKEN_MATCH') ? 'FAIL' : 'PASS') + ' | Workspace and Git patch scan |',
    '| PEM private keys | ' + (allIssues.some(x => x.type === 'PRIVATE_KEY_PEM_MATCH') ? 'FAIL' : 'PASS') + ' | Workspace and Git patch scan |',
    '| Wallet fingerprint | ' + walletCheckResult + ' | ' + walletStatus + ' |',
    '| Local absolute paths | ' + (allIssues.some(x => x.type === 'LOCAL_ABSOLUTE_PATH_MATCH') ? 'FAIL' : 'PASS') + ' | Current public files and sanitized history snapshot |',
    '| .gitignore coverage | ' + (ignoreChecks.every(x => x.pass) ? 'PASS' : 'FAIL') + ' | ' + ignoreChecks.filter(x => x.pass).length + '/' + ignoreChecks.length + ' required paths ignored |',
    '',
    '## Ignore-rule verification',
    '',
    ...ignoreChecks.map(x => '- ' + (x.pass ? 'PASS' : 'FAIL') + ' — ' + x.path),
    '',
    '## Findings',
    '',
    ...issueLines,
    '',
    '## Repository and history notes',
    '',
    '- Origin: ' + originUrl,
    '- audit-package/git_history.txt is a path-redacted commit metadata and diffstat summary; raw git log -p is scanned for credentials but not exported.',
    '- Existing Git commit objects were not rewritten; older commit pages may still retain historical local-path strings in their original diffs.',
    '- If .secrets/wallet.json is absent, wallet-fingerprint comparison is explicitly SKIPPED and is not reported as verified.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(repoDir, 'audit-package', 'git_security_audit.md'), report, 'utf8');
  console.log('Security audit:', status);
  console.log('Workspace files scanned:', trackedFiles.length);
  console.log('Workspace findings:', workspaceIssues.length);
  console.log('Git-history secret findings:', historyIssues.length);
  console.log('Wallet fingerprint:', walletStatus);
  console.log('Git-ignore checks:', ignoreChecks.filter(x => x.pass).length + '/' + ignoreChecks.length);
  return { status, workspaceIssues, historyIssues, ignoreChecks, walletStatus, currentHeadSha };
}

module.exports = { scanText, redactLocalPaths, evaluateAudit, runAudit };
if (require.main === module) {
  try {
    const result = runAudit();
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error('Security audit failed to execute:', error.message);
    process.exitCode = 1;
  }
}
