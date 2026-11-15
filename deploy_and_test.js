const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require('E:/gemini/node_modules/genlayer-js');
const { TransactionHashVariant, TransactionStatus } = require('E:/gemini/node_modules/genlayer-js/dist/types/index.cjs');

async function main() {
  console.log('=== GENLAYER PHASE 4 REAL STUDIONET DEPLOYMENT & EXECUTION ===');
  const secretPath = path.join(__dirname, '.secrets', 'wallet.json');
  if (!fs.existsSync(secretPath)) {
    throw new Error('Secret wallet file not found.');
  }
  const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  const account = createAccount(secret.privateKey);

  console.log('Deployer Account:', account.address);
  console.log('Network:', chains.studionet.name, `(Chain ID: ${chains.studionet.id})`);
  console.log('RPC URL:', chains.studionet.rpcUrls.default.http[0]);

  const client = createClient({
    chain: chains.studionet,
    account: account
  });

  // 读取智能合约源码
  const contractPath = path.join(__dirname, 'contracts', 'ProofOfUptime.py');
  const contractCode = fs.readFileSync(contractPath, 'utf8');
  console.log('Contract source size:', contractCode.length, 'bytes');

  // 1. 部署合约
  console.log('\n[1/5] Submitting contract deployment transaction...');
  const t0 = Date.now();
  const deployTxHash = await client.deployContract({
    account,
    code: contractCode,
    args: []
  });
  console.log('Deployment Transaction Hash:', deployTxHash);

  // 2. 轮询直到 FINALIZED
  console.log('\n[2/5] Waiting for deployment transaction to be FINALIZED...');
  const deployReceipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60
  });
  const deployDurationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Deployment reached FINALIZED in ${deployDurationSec}s!`);
  console.log('Deploy Receipt status:', deployReceipt.status);

  // 提取部署出的合约地址
  let contractAddress = null;
  if (deployReceipt.contractAddress) {
    contractAddress = deployReceipt.contractAddress;
  } else if (deployReceipt.recipient) {
    contractAddress = deployReceipt.recipient;
  } else if (deployReceipt.to) {
    contractAddress = deployReceipt.to;
  }
  
  // 如果 receipt 简写对象中无显式 contractAddress，尝试从全量交易中提取
  if (!contractAddress) {
    const fullTx = await client.getTransaction({ hash: deployTxHash });
    console.log('Full Tx details:', JSON.stringify(fullTx, null, 2));
    contractAddress = fullTx.contract_address || fullTx.contractAddress || fullTx.data?.contract_address;
  }

  console.log('Deployed Contract Address:', contractAddress);
  if (!contractAddress) {
    throw new Error('Failed to resolve deployed contract address from receipt.');
  }

  // 保存合约地址
  fs.writeFileSync(path.join(__dirname, 'contract-address.txt'), contractAddress, 'utf8');

  // 3. 提交真实写交易：register_target
  console.log('\n[3/5] Submitting write transaction: register_target...');
  const t1 = Date.now();
  const writeTxHash = await client.writeContract({
    account,
    address: contractAddress,
    functionName: 'register_target',
    args: ['Cloudflare DNS', 'https://1.1.1.1']
  });
  console.log('Write Transaction Hash:', writeTxHash);

  // 4. 等待写交易达到 FINALIZED
  console.log('\n[4/5] Waiting for write transaction to be FINALIZED...');
  const writeReceipt = await client.waitForTransactionReceipt({
    hash: writeTxHash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60
  });
  const writeDurationSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`Write transaction reached FINALIZED in ${writeDurationSec}s!`);
  console.log('Write Receipt status:', writeReceipt.status);

  // 5. 链上只读 Read-back 终态验证
  console.log('\n[5/5] Performing on-chain read-back with LATEST_FINAL...');
  const targetCount = await client.readContract({
    address: contractAddress,
    functionName: 'get_target_count',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Read-back get_target_count:', targetCount);

  const target0Raw = await client.readContract({
    address: contractAddress,
    functionName: 'get_target',
    args: [0],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Read-back get_target(0):', target0Raw);

  const listTargetsRaw = await client.readContract({
    address: contractAddress,
    functionName: 'list_targets',
    args: [0, 5],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Read-back list_targets(0, 5):', listTargetsRaw);

  const target0Parsed = JSON.parse(target0Raw);
  const dataMatch = (target0Parsed.name === 'Cloudflare DNS' && target0Parsed.url === 'https://1.1.1.1');
  console.log('Data Consistency Check:', dataMatch ? '100% VERIFIED' : 'MISMATCH');

  // 收集并固化证据
  const evidence = {
    testTimestamp: new Date().toISOString(),
    network: {
      name: chains.studionet.name,
      chainId: chains.studionet.id,
      rpc: chains.studionet.rpcUrls.default.http[0]
    },
    deployerAddress: account.address,
    contract: {
      name: 'ProofOfUptime',
      address: contractAddress,
      deployTxHash: deployTxHash,
      deployDurationSec: deployDurationSec,
      deployReceiptStatus: String(deployReceipt.status)
    },
    interactions: [
      {
        action: 'register_target',
        args: ['Cloudflare DNS', 'https://1.1.1.1'],
        txHash: writeTxHash,
        durationSec: writeDurationSec,
        receiptStatus: String(writeReceipt.status)
      }
    ],
    readBack: {
      targetCount: Number(targetCount),
      target0: target0Parsed,
      listTargets: JSON.parse(listTargetsRaw),
      isConsistent: dataMatch
    }
  };

  fs.writeFileSync(path.join(__dirname, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
  console.log('\nSUCCESS: All operations finalized on-chain and evidence recorded in evidence.json!');
}

main().catch(err => {
  console.error('\nFATAL ERROR during deployment / execution:', err);
  process.exit(1);
});
