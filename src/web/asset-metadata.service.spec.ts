import { AssetMetadataService } from './asset-metadata.service';

class NeoClientStub {
  public labelCalls = 0;
  public decimalsCalls = 0;

  async fetchTransactionsForDay(_date: string) {
    return {
      transactions: [],
    };
  }

  async resolveAssetLabel(asset: string): Promise<string | null> {
    this.labelCalls += 1;

    return `label:${asset}`;
  }

  async resolveAssetDecimals(_asset: string): Promise<number | null> {
    this.decimalsCalls += 1;

    return 8;
  }
}

describe('AssetMetadataService', () => {
  it('reuses cached metadata across concurrent and repeated asset lookups', async () => {
    const neoClient = new NeoClientStub();
    const service = new AssetMetadataService(neoClient);

    const [first, second, third] = await Promise.all([
      service.getAssetMetadata('0xfusd'),
      service.getAssetMetadata('0xfusd'),
      service.getAssetMetadata('FUSD'),
    ]);

    expect(first).toEqual({
      label: 'label:0xfusd',
      decimals: 8,
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(neoClient.labelCalls).toBe(1);
    expect(neoClient.decimalsCalls).toBe(1);

    const fourth = await service.getAssetMetadata('0xfusd');

    expect(fourth).toEqual(first);
    expect(neoClient.labelCalls).toBe(1);
    expect(neoClient.decimalsCalls).toBe(1);
  });
});
