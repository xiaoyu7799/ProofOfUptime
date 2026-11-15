const fs = require('fs');
const path = require('path');
const { createAccount, generatePrivateKey } = require('genlayer-js');

const secretsDir = path.join(__dirname, '.secrets');
if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
}

// 使用 SDK 内置的加密学安全私钥生成函数
const privateKey = generatePrivateKey();
const account = createAccount(privateKey);

const secretPath = path.join(secretsDir, 'wallet.json');
fs.writeFileSync(secretPath, JSON.stringify({
  address: account.address,
  privateKey: privateKey,
  createdAt: new Date().toISOString(),
  network: 'GenLayer Stable Studionet (61999)'
}, null, 2), 'utf-8');

// 仅保存公开地址
const publicAddrPath = path.join(__dirname, 'wallet-address.txt');
fs.writeFileSync(publicAddrPath, account.address, 'utf-8');

console.log('SUCCESS: Disposable test wallet generated safely.');
console.log('Public Address:', account.address);
console.log('Secret stored at:', secretPath);
