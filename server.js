const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const frontendPort = 3000;
const apiPort = 8080;
const publicDir = path.join(__dirname, 'public');

const transactions = [];
const transactionIndex = new Map();
const accountBalances = new Map();

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function createTransaction(accountId, amount) {
  const currentBalance = accountBalances.get(accountId) || 0;
  const balance = currentBalance + amount;
  const transaction = {
    transaction_id: crypto.randomUUID(),
    account_id: accountId,
    amount,
    created_at: new Date().toISOString(),
  };

  transactions.unshift(transaction);
  transactionIndex.set(transaction.transaction_id, transaction);
  accountBalances.set(accountId, balance);

  return transaction;
}

function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    sendText(res, 204, '');
    return;
  }

  if (req.method === 'GET' && pathname === '/ping') {
    sendText(res, 200, 'pong');
    return;
  }

  if (req.method === 'GET' && pathname === '/transactions') {
    sendJson(res, 200, transactions);
    return;
  }

  if (req.method === 'POST' && pathname === '/transactions') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      sendJson(res, 415, { error: 'Content-Type must be application/json' });
      return;
    }

    parseJsonBody(req)
      .then((body) => {
        const { account_id: accountId, amount } = body;

        if (typeof accountId !== 'string' || !Number.isInteger(amount)) {
          sendJson(res, 400, { error: 'Invalid transaction payload' });
          return;
        }

        const transaction = createTransaction(accountId, amount);
        sendJson(res, 201, transaction);
      })
      .catch(() => {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      });
    return;
  }

  const transactionMatch = pathname.match(/^\/transactions\/([^/]+)$/);
  if (req.method === 'GET' && transactionMatch) {
    const transactionId = transactionMatch[1];
    const transaction = transactionIndex.get(transactionId);

    if (!transaction) {
      sendJson(res, 404, { error: 'Transaction not found' });
      return;
    }

    sendJson(res, 200, transaction);
    return;
  }

  const accountMatch = pathname.match(/^\/accounts\/([^/]+)$/);
  if (req.method === 'GET' && accountMatch) {
    const accountId = accountMatch[1];

    if (!accountBalances.has(accountId)) {
      sendJson(res, 404, { error: 'Account not found' });
      return;
    }

    sendJson(res, 200, {
      account_id: accountId,
      balance: accountBalances.get(accountId),
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

function getFilePath(pathname) {
  if (pathname === '/') {
    return path.join(publicDir, 'index.html');
  }

  const unsafePath = path.join(publicDir, pathname);
  const normalizedPath = path.normalize(unsafePath);

  if (!normalizedPath.startsWith(publicDir)) {
    return null;
  }

  return normalizedPath;
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  return 'application/octet-stream';
}

function handleFrontend(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = getFilePath(url.pathname);

  if (!filePath) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, 'Not found');
      return;
    }

    sendText(res, 200, content, getContentType(filePath));
  });
}

const apiServer = http.createServer(handleApi);
const frontendServer = http.createServer(handleFrontend);

apiServer.listen(apiPort, () => {
  console.log(`API server running at http://localhost:${apiPort}`);
});

frontendServer.listen(frontendPort, () => {
  console.log(`Frontend server running at http://localhost:${frontendPort}`);
});
