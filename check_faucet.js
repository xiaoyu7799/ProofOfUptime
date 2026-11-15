const url = 'https://studio.genlayer.com/api';
const address = '0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121';

async function checkBalance() {
  console.log('=== CHECKING BALANCE ===');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    })
  });
  const data = await res.json();
  console.log('eth_getBalance response:', JSON.stringify(data));
  if (data.result) {
    const dec = BigInt(data.result);
    console.log('Balance (Dec Wei):', dec.toString());
    console.log('Balance (GEN):', (Number(dec) / 1e18).toFixed(6));
  }
}

async function probeFaucet() {
  console.log('\n=== PROBING FAUCET METHODS ===');
  const candidates = [
    { method: 'gen_requestFunds', params: [address] },
    { method: 'gen_faucet', params: [address] },
    { method: 'faucet_request', params: [address] },
    { method: 'eth_requestFunds', params: [address] }
  ];
  for (const c of candidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: c.method, params: c.params })
      });
      const data = await res.json();
      console.log(`${c.method}:`, JSON.stringify(data));
    } catch (e) {
      console.log(`${c.method} error:`, e.message);
    }
  }

  // 探查 studio.genlayer.com 相关的 HTTP 路径
  const httpEndpoints = [
    'https://studio.genlayer.com/api/faucet',
    'https://studio.genlayer.com/faucet',
    'https://testnet-faucet.genlayer.foundation/api/claim'
  ];
  for (const ep of httpEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      console.log(`${ep} HTTP status:`, res.status);
      const text = await res.text();
      console.log(`${ep} body:`, text.slice(0, 150));
    } catch (e) {
      console.log(`${ep} error:`, e.message);
    }
  }
}

async function run() {
  await checkBalance();
  await probeFaucet();
}

run();
