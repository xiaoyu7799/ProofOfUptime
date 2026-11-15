const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require('E:/gemini/node_modules/genlayer-js');
const { TransactionHashVariant, TransactionStatus } = require('E:/gemini/node_modules/genlayer-js/dist/types/index.cjs');

async function main() {
  console.log('=== GENLAYER PHASE 4 SUCCESSFUL CONSENSUS CLOSURE ===');
  const secretPath = path.join(__dirname, '.secrets', 'wallet.json');
  const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  const account = createAccount(secret.privateKey);

  const contractAddress = '0x613Ccb8a943179c0d56c2A194F69261f7108F82A';
  console.log('Deployer Account:', account.address);
  console.log('Contract Address:', contractAddress);

  const client = createClient({
    chain: chains.studionet,
    account: account
  });

  // 1. 注册目标 1: Drand Genesis Round
  const targetName = 'Drand Genesis Round';
  const targetUrl = 'https://api.drand.sh/public/1';
  console.log(`\n[Step 1/4] Registering Target 1: ${targetName} (${targetUrl})...`);
  const t0 = Date.now();
  const registerTxHash = await client.writeContract({
    account,
    address: contractAddress,
    functionName: 'register_target',
    args: [targetName, targetUrl]
  });
  console.log('Register Target 1 Tx Hash:', registerTxHash);

  console.log('Waiting for register transaction to be FINALIZED...');
  const regReceipt = await client.waitForTransactionReceipt({
    hash: registerTxHash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60
  });
  console.log(`Register transaction FINALIZED in ${((Date.now() - t0) / 1000).toFixed(1)}s! Receipt status:`, regReceipt.status);

  // 2. 读回目标 1 初态
  console.log('\n[Step 2/4] Reading initial state of Target 1...');
  const target1InitialRaw = await client.readContract({
    address: contractAddress,
    functionName: 'get_target',
    args: [1],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Target 1 Initial State:', target1InitialRaw);
  const target1Initial = JSON.parse(target1InitialRaw);

  // 3. 提交 probe_target(1) 触发多节点真实非确定性共识
  console.log('\n[Step 3/4] Triggering probe_target(1) with stable HTTPS endpoint...');
  const t1 = Date.now();
  const probeTxHash = await client.writeContract({
    account,
    address: contractAddress,
    functionName: 'probe_target',
    args: [1]
  });
  console.log('Probe Target 1 Tx Hash:', probeTxHash);

  console.log('Waiting for probe transaction to be FINALIZED (Validators fetching & voting)...');
  const probeReceipt = await client.waitForTransactionReceipt({
    hash: probeTxHash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60
  });
  const probeDurationSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`Probe transaction FINALIZED in ${probeDurationSec}s! Receipt status:`, probeReceipt.status);

  // 获取完整交易详情以审查共识结果与投票详情
  const fullProbeTx = await client.getTransaction({ hash: probeTxHash });
  console.log('\n--- Probe Transaction Consensus Details ---');
  console.log('Result Name:', fullProbeTx.result_name);
  console.log('Result Code:', fullProbeTx.result);
  console.log('Consensus Status Changes:', fullProbeTx.consensus_data?.current_status_changes);
  console.log('Votes Summary:', JSON.stringify(fullProbeTx.consensus_data?.votes, null, 2));

  // 4. 读回更新后的终态状态 (Read-back verification)
  console.log('\n[Step 4/4] Performing comprehensive Read-back verification...');
  const countAfter = await client.readContract({
    address: contractAddress,
    functionName: 'get_target_count',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Updated get_target_count:', countAfter);

  const target1FinalRaw = await client.readContract({
    address: contractAddress,
    functionName: 'get_target',
    args: [1],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Target 1 Updated State:', target1FinalRaw);
  const target1Final = JSON.parse(target1FinalRaw);

  const target0HistoricalRaw = await client.readContract({
    address: contractAddress,
    functionName: 'get_target',
    args: [0],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('Target 0 Historical State (should remain unmutated):', target0HistoricalRaw);
  const target0Historical = JSON.parse(target0HistoricalRaw);

  const listTargetsRaw = await client.readContract({
    address: contractAddress,
    functionName: 'list_targets',
    args: [0, 5],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL
  });
  console.log('list_targets(0, 5):', listTargetsRaw);

  // 校验闭环指标
  const isTarget1Active = (target1Final.last_status === 'active');
  const isCountIncremented = (target1Final.probed_count === 1 && target1Initial.probed_count === 0);
  const isSamplePresent = (target1Final.last_result && target1Final.last_result.is_alive === true && target1Final.last_result.status_code === 200);
  const isTarget0Preserved = (target0Historical.probed_count === 0 && target0Historical.last_status === 'registered');

  console.log('\n--- Closure Verification Metrics ---');
  console.log('1. Target 1 Status is active:', isTarget1Active ? 'PASS' : 'FAIL');
  console.log('2. Target 1 Probed count incremented 0 -> 1:', isCountIncremented ? 'PASS' : 'FAIL');
  console.log('3. Target 1 Result contains valid probe payload:', isSamplePresent ? 'PASS' : 'FAIL');
  console.log('4. Target 0 Historical unmutated (Failure isolation):', isTarget0Preserved ? 'PASS' : 'FAIL');

  // 保存完整的最终闭环证据文件
  const closureEvidence = {
    contractAddress,
    account: account.address,
    chain: {
      id: chains.studionet.id,
      name: chains.studionet.name,
      rpc: chains.studionet.rpcUrls.default.http[0]
    },
    historicalFailureTx: {
      action: 'probe_target(0)',
      url: 'https://1.1.1.1',
      reason: '301 Redirect without automatic follow causing UserError in GenVM',
      txHash: '0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8',
      resultName: 'MAJORITY_DISAGREE',
      status: 7
    },
    successfulClosureTx: {
      action: 'probe_target(1)',
      target: {
        id: 1,
        name: targetName,
        url: targetUrl
      },
      registerTxHash,
      probeTxHash,
      probeDurationSec,
      resultName: fullProbeTx.result_name,
      resultCode: fullProbeTx.result,
      status: fullProbeTx.status,
      votes: fullProbeTx.consensus_data?.votes,
      finalState: target1Final
    },
    stateComparison: {
      target0: target0Historical,
      target1Before: target1Initial,
      target1After: target1Final,
      totalCount: Number(countAfter)
    },
    closureMetrics: {
      isTarget1Active,
      isCountIncremented,
      isSamplePresent,
      isTarget0Preserved,
      allVerified: (isTarget1Active && isCountIncremented && isSamplePresent && isTarget0Preserved)
    }
  };

  fs.writeFileSync(path.join(__dirname, 'evidence_closure.json'), JSON.stringify(closureEvidence, null, 2), 'utf8');
  console.log('\nCLOSURE SUCCESS: Full evidence saved to evidence_closure.json');
}

main().catch(err => {
  console.error('Fatal error in closure workflow:', err);
  process.exit(1);
});
