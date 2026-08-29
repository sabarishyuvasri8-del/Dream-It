const fetch = require('node-fetch');
async function testSignIn() {
  const res = await fetch('https://clever-alpaca-54.clerk.accounts.dev/v1/client/sign_ins?_clerk_js_version=5.0.0', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'http://localhost:5173'
    },
    body: 'identifier=sabarish&password=saba_2277'
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
testSignIn();
