import { classifyTransaction, ClassifiedType, defaultSwapMethods } from '../src/classifier/classifier';
import { NeoTransaction } from '../src/neo-client/neo-client.interface';

describe('classifier', () => {
  const config = {
    dexContractAllowlist: ['0xswap'],
    swapMethodAllowlist: defaultSwapMethods,
    gasClaimContracts: ['0xclaim'],
  };

  it('classifies swap as real usage', () => {
    const tx: NeoTransaction = {
      txid: '1',
      timestamp: new Date().toISOString(),
      invocation: { contract: '0xswap', method: 'swap' },
      transfers: [{ from: 'a', to: 'b', asset: 'GAS', amount: '1' }],
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
      invocation: { contract: '0xswap', method: 'swap' },
      transfers: [{ from: 'a', to: 'b', asset: 'NEO', amount: '5' }],
      raw: {},
    };

    const result = classifyTransaction(tx, config);
    expect(result.type).toBe(ClassifiedType.SWAP);
  });
});
