import type React from 'react';
import type { MarketPrices } from '../types';

type MarketTickerProps = {
  marketPrices?: MarketPrices;
  className?: string;
};

export const MarketTicker: React.FC<MarketTickerProps> = ({ marketPrices, className }) => {
  const entries = [
    {
      symbol: 'NEO',
      entry: marketPrices?.neo,
    },
    {
      symbol: 'GAS',
      entry: marketPrices?.gas,
    },
  ].filter((item) => item.entry?.price);

  if (entries.length === 0) {
    return null;
  }

  const rootClassName = className ? `market-ticker ${className}` : 'market-ticker';

  return (
    <section className={rootClassName} aria-label="Latest NEO and GAS prices">
      {entries.map(({ symbol, entry }) => (
        <div className="market-ticker-pill" key={symbol}>
          <strong className="market-ticker-line">
            {symbol} {entry?.price}
          </strong>
          {entry?.change24h ? (
            <span className={`market-ticker-change is-${entry.tone}`}> ({entry.change24h})</span>
          ) : null}
        </div>
      ))}
    </section>
  );
};
