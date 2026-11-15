const url = 'https://studio.genlayer.com/api/faucet';
const address = '0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121';

async function testRpc() {
  const methods = [
    'faucet',
    'fund',
    'claim',
    'requestFunds',
    'gen_faucet',
    'gen_requestFunds',
    'eth_requestFunds'
  ];

  for (const m of methods) {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: m,
      params: [address]
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log(`Method ${m} -> Status ${res.status}:`, await res.text());
  }
}

testRpc();
