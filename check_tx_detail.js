const { createClient, chains } = require('genlayer-js');

async function checkTx() {
  const client = createClient({ chain: chains.studionet });
  const txHash = '0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8';
  const tx = await client.getTransaction({ hash: txHash });
  console.log('Transaction:', JSON.stringify(tx, null, 2));
}

checkTx().catch(console.error);
