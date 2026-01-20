import { classifyTransaction, ClassifiedType, defaultSwapMethods } from '../src/classifier/classifier';
import { NeoTransaction } from '../src/neo-client/neo-client.interface';

describe('classifier', () => {
  const config = {
    swapMethodAllowlist: defaultSwapMethods,
  };

  it('classifies swap when multiple transfers with swap method', () => {
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
    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it.each(['OrderUpdated', 'OrderUpserted'])(
    'classifies swap based on dex-like order notifications (%s)',
    (eventname) => {
      const tx: NeoTransaction = {
        txid: `order-notification-${eventname}`,
        timestamp: new Date().toISOString(),
        transfers: [],
        raw: {
          applicationLog: {
            executions: [
              {
                notifications: [
                  {
                    eventname,
                  },
                ],
              },
            ],
          },
        },
      };

      const result = classifyTransaction(tx, config);
      expect(result.type).toBe(ClassifiedType.SWAP);
    },
  );

  it.each([
    '0xec268e9c642b7d09d10fe658bcb1cc63c0895d4d',
    '0xca2d20610d7982ebe0bed124ee7e9b2d580a6efc',
    '0x3244fcadcccff190c329f7b3083e4da2af60fbce',
    '0xde3a4b093abbd07e9a69cdec88a54d9a1fe14975',
  ])('classifies swap when known swap contract is called (%s)', (contract) => {
    const tx: NeoTransaction = {
      txid: `swap-contract-call-${contract}`,
      timestamp: new Date().toISOString(),
      invocation: { contract, method: 'any' },
      transfers: [],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it('classifies swap when known swap contract notification is present', () => {
    const contract = '0xec268e9c642b7d09d10fe658bcb1cc63c0895d4d';
    const tx: NeoTransaction = {
      txid: 'swap-contract-notification',
      timestamp: new Date().toISOString(),
      transfers: [],
      raw: {
        applicationLog: {
          executions: [
            {
              notifications: [
                {
                  contract,
                  eventname: 'AccountUpdated',
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

  it('classifies swap when known swap contract call matches gas claim pattern', () => {
    const contract = '0xec268e9c642b7d09d10fe658bcb1cc63c0895d4d';
    const tx: NeoTransaction = {
      txid: 'swap-contract-overrides-gas-claim',
      timestamp: new Date().toISOString(),
      invocation: { contract, method: 'any' },
      transfers: [{ from: undefined, to: 'user123', asset: 'GAS', amount: '5.5' }],
      raw: {},
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

  it('excludes self-transfer from totals', () => {
    const tx: NeoTransaction = {
      txid: '3',
      timestamp: new Date().toISOString(),
      transfers: [{ from: 'same', to: 'same', asset: 'NEO', amount: '2' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.IGNORED);
  });

  it('gives swap precedence over gas claim and transfer', () => {
    const tx: NeoTransaction = {
      txid: '4',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xanycontract', method: 'swap' },
      transfers: [
        { from: 'a', to: 'b', asset: 'NEO', amount: '5' },
        { from: 'b', to: 'a', asset: 'GAS', amount: '50' },
      ],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });

  it('does not classify as swap if only one transfer even with swap method', () => {
    const tx: NeoTransaction = {
      txid: '5',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xanycontract', method: 'swap' },
      transfers: [{ from: 'a', to: 'b', asset: 'NEO', amount: '1' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.NORMAL_TRANSFER);
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

  it('gives swap precedence over gas claim when both patterns present', () => {
    const tx: NeoTransaction = {
      txid: '8',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xdex', method: 'swap' },
      transfers: [
        { from: undefined, to: 'user', asset: 'GAS', amount: '1' },
        { from: 'user', to: 'pool', asset: 'NEO', amount: '10' },
      ],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });
});
