import { classifyTransaction, ClassifiedType, defaultSwapMethods } from '../src/classifier/classifier';
import { NeoTransaction } from '../src/neo-client/neo-client.interface';

describe('classifier', () => {
  const config = {
    swapMethodAllowlist: defaultSwapMethods,
    gasClaimContracts: ['0xclaim'],
  };

  it('classifies swap as real usage when multiple transfers with swap method', () => {
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

  it('classifies gas claim as not real usage', () => {
    const tx: NeoTransaction = {
      txid: '2',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xclaim', method: 'claim' },
      transfers: [{ from: 'a', to: 'b', asset: 'GAS', amount: '1' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.GAS_CLAIM);
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
});
