const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require('E:/gemini/node_modules/genlayer-js');
const { TransactionHashVariant, TransactionStatus } = require('E:/gemini/node_modules/genlayer-js/dist/types/index.cjs');

async function main() {
  console.log('=== EXECUTING NONDET PROBE CONSENSUS TRANSACTION ===');
  const secretPath = path.join(__dirname, '.secrets', 'wallet.json');
  const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  const account = createAccount(secret.privateKey);

  const contractAddressPath = path.join(__dirname, 'contract-address.txt');
  const contractAddress = fs.readFileSync(contractAddressPath, 'utf8').trim();
  console.log('Contract Address:', contractAddress);

  const client = createClient({
    chain: chains.studionet,
    account: account
  });

  console.log('Submitting probe_target(0)...');
  const t0 = Date.now();
  const txHash = await client.writeContract({
    account,
    address: contractAddress,
    functionName: 'probe_target',
    args: [0]
  });
  console.log('Probe Transaction Hash:', txHash);

  console.log('Waiting for probe transaction to be FINALIZED (Validators fetching & voting)...');
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60
  });
  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Probe transaction reached FINALIZED in ${durationSec}s!`);
  console.log('Receipt status:', receipt.status);

  // Read-back updated target status
  console.log('Reading back updated target state...');
  const updatedTargetRaw = await client.readContract({
    address: contractAddress,
    functionName: 'get_target',
    args: [0],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Updated Target State:', updatedTargetRaw);

  const parsed = JSON.parse(updatedTargetRaw);
  console.log('Last Status:', parsed.last_status);
  console.log('Probed Count:', parsed.probed_count);
  console.log('Last Result:', JSON.stringify(parsed.last_result));

  // 更新 evidence.json
  const evidencePath = path.join(__dirname, 'evidence.json');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  evidence.interactions.push({
    action: 'probe_target',
    args: [0],
    txHash: txHash,
    durationSec: durationSec,
    receiptStatus: String(receipt.status)
  });
  evidence.readBack.target0AfterProbe = parsed;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');

  console.log('SUCCESS: Nondet consensus verified and evidence updated!');
}

main().catch(err => {
  console.error('Probe execution error:', err);
  process.exit(1);
});
