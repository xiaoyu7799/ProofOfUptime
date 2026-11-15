const fs = require('fs');
const path = require('path');
const { createAccount } = require('E:/gemini/node_modules/genlayer-js');

const secretPath = path.join(__dirname, '.secrets', 'wallet.json');
const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));

// 从本地隔离秘密文件中读取私钥初始化账户
const account = createAccount(secret.privateKey);

async function run() {
  console.log('=== WALLET SIGNATURE VERIFICATION ===');
  console.log('Account Address:', account.address);
  console.log('Address Match:', account.address.toLowerCase() === secret.address.toLowerCase());

  // 1. signMessage
  const message = 'GenLayer Phase 4 Autonomous Verification - Chain ID 61999';
  const sig = await account.signMessage({ message });
  console.log('Message:', message);
  console.log('Signature:', sig);

  // 2. 验证签名恢复
  const { recoverMessageAddress } = require('E:/gemini/node_modules/viem');
  const recovered = await recoverMessageAddress({ message, signature: sig });
  console.log('Recovered Address:', recovered);
  console.log('Signature Recovery Match:', recovered.toLowerCase() === account.address.toLowerCase());
}

run().catch(console.error);
