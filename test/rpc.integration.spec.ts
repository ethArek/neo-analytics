import * as https from 'https';
import * as dotenv from 'dotenv';

dotenv.config();

const rpcEndpoints = [
  process.env.RPC_ENDPOINT_1 || 'https://mainnet1.neo.coz.io',
  process.env.RPC_ENDPOINT_2 || 'https://mainnet2.neo.coz.io',
];

const shouldRun = process.env.REAL_RPC_TEST === 'true';
const describeRpc = shouldRun ? describe : describe.skip;

type JsonRpcResponse = {
  jsonrpc: string;
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const callRpc = (endpoint: string, method: string, params: unknown[] = []) =>
  new Promise<JsonRpcResponse>((resolve, reject) => {
    const url = new URL(endpoint);
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });

    const request = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname === '' ? '/' : url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data) as JsonRpcResponse);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('error', reject);
    request.write(payload);
    request.end();
  });

describeRpc('Neo RPC integration', () => {
  jest.setTimeout(20000);

  it('responds to getversion on public RPC endpoints', async () => {
    for (const endpoint of rpcEndpoints) {
      const response = await callRpc(endpoint, 'getversion');

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 1);
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result).toHaveProperty('protocol');
      expect(response.result).toHaveProperty('protocol.network');
    }
  });
});
