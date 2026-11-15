const address = '0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121';

async function testEndpoints() {
  const tests = [
    { url: `https://studio.genlayer.com/api/faucet?address=${address}`, method: 'GET' },
    { url: `https://studio.genlayer.com/api/faucet?address=${address}`, method: 'POST' },
    { url: `https://studio.genlayer.com/api/faucet`, method: 'POST', body: { address } },
    { url: `https://studio.genlayer.com/api/faucet`, method: 'POST', body: { recipient: address } },
    { url: `https://studio.genlayer.com/api/faucet`, method: 'POST', body: { account: address } }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: { 'Content-Type': 'application/json' },
        body: t.body ? JSON.stringify(t.body) : undefined
      });
      console.log(`${t.method} ${t.url} -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response text: [${text}]`);
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

testEndpoints();
