import { classifyTransaction, ClassifiedType, defaultSwapMethods } from '../src/classifier/classifier';
import { NeoTransaction } from '../src/neo-client/neo-client.interface';

describe('classifier', () => {
  const config = {
    swapMethodAllowlist: defaultSwapMethods,
  };

  it('does not classify swap just because method is named swap', () => {
    const tx: NeoTransaction = {
      txid: '1',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xanycontract', method: 'swap' },
      transfers: [
        { from: 'a', to: 'b', asset: 'NEO', amount: '1' },
        { from: 'b', to: 'a', asset: 'GAS', amount: '10' },
      ],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.NORMAL_TRANSFER);
  });

  it('classifies swap based on swap-like notifications when invocation is missing', () => {
    const tx: NeoTransaction = {
      txid: 'swap-event',
      timestamp: new Date().toISOString(),
      transfers: [
        { from: 'user', to: 'pool', asset: 'TOKEN-A', amount: '1' },
        { from: 'pool', to: 'user', asset: 'TOKEN-B', amount: '2' },
      ],
      raw: {
        applicationLog: {
          executions: [
            {
              notifications: [
                {
                  eventname: 'Swapped',
                },
              ],
            },
          ],
        },
      },
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it('classifies swap based on dex-like order notifications', () => {
    const tx: NeoTransaction = {
      txid: 'order-upserted',
      timestamp: new Date().toISOString(),
      transfers: [],
      raw: {
        applicationLog: {
          executions: [
            {
              notifications: [
                {
                  eventname: 'OrderUpdated',
                },
              ],
            },
          ],
        },
      },
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it('classifies non-native token transfers as normal transfer', () => {
    const tx: NeoTransaction = {
      txid: 'token-transfer',
      timestamp: new Date().toISOString(),
      transfers: [{ from: 'a', to: 'b', asset: '0xtoken', amount: '100' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.NORMAL_TRANSFER);
  });

  it('classifies gas claim based on transaction data (no from address)', () => {
    const tx: NeoTransaction = {
      txid: '2',
      timestamp: new Date().toISOString(),
      transfers: [{ from: undefined, to: 'user123', asset: 'GAS', amount: '5.5' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.GAS_CLAIM);
    expect(result.reason).toContain('GAS claim');
  });

  it('classifies gas claim with NEO self-transfer + GAS mint', () => {
    const tx: NeoTransaction = {
      txid: 'gas-claim-with-neo',
      timestamp: new Date().toISOString(),
      transfers: [
        { from: '0xabc', to: '0xabc', asset: 'NEO', amount: '1' },
        { from: undefined, to: '0xabc', asset: 'GAS', amount: '1063349' },
      ],
      raw: {},
    };

    const result = classifyTransaction(tx, config);

    expect(result.type).toBe(ClassifiedType.GAS_CLAIM);
  });

  it('gives swap precedence over gas claim when swap event is present', () => {
    const tx: NeoTransaction = {
      txid: 'swap-event-with-gas-claim',
      timestamp: new Date().toISOString(),
      transfers: [
        { from: undefined, to: '0xabc', asset: 'GAS', amount: '1063349' },
        { from: '0xabc', to: '0xabc', asset: 'NEO', amount: '1' },
      ],
      raw: {
        applicationLog: {
          executions: [
            {
              notifications: [
                {
                  eventname: 'Swapped',
                },
              ],
            },
          ],
        },
      },
    };

    const result = classifyTransaction(tx, config);

    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it('excludes self-transfer from real usage', () => {
    const tx: NeoTransaction = {
      txid: '3',
      timestamp: new Date().toISOString(),
      transfers: [{ from: 'same', to: 'same', asset: 'NEO', amount: '2' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.IGNORED);
  });

  it('classifies non-transfer activity as OTHER', () => {
    const tx: NeoTransaction = {
      txid: 'other',
      timestamp: new Date().toISOString(),
      transfers: [],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.OTHER);
  });

  it('classifies gas claim with empty string as from address', () => {
    const tx: NeoTransaction = {
      txid: '6',
      timestamp: new Date().toISOString(),
      transfers: [{ from: '', to: 'user456', asset: 'GAS', amount: '2.5' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.GAS_CLAIM);
  });

  it('does not classify normal GAS transfer as gas claim', () => {
    const tx: NeoTransaction = {
      txid: '7',
      timestamp: new Date().toISOString(),
      transfers: [{ from: 'userA', to: 'userB', asset: 'GAS', amount: '3' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.NORMAL_TRANSFER);
  });

});
