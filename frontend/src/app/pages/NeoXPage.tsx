import type React from 'react';
import { useEffect } from 'react';
import { initNeoXCharts } from '../../charts/neo-x';
import { DateRangeForm } from '../components/DateRangeForm';
import { Navbar } from '../components/Navbar';
import { useTheme } from '../theme';
import type { MetricCard, NeoXData, NeoXRecentTransaction, NeoXToken } from '../types';
import { delayStyle, ensureArray, getPageData } from '../utils';

const MetricGrid: React.FC<{
  cards: MetricCard[];
}> = ({ cards }) => {
  return (
    <section className="summary-grid">
      {cards.map((card, index) => (
        <div
          key={`${card.label}-${index}`}
          className={`card ${card.accent ? 'accent' : ''}`}
          data-animate
          style={delayStyle(`${0.04 + index * 0.04}s`)}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {card.detail ? <small>{card.detail}</small> : null}
        </div>
      ))}
    </section>
  );
};

const RecentTransactionsList: React.FC<{
  items: NeoXRecentTransaction[];
}> = ({ items }) => {
  return (
    <div className="list-card" data-animate style={delayStyle('0.28s')}>
      <h3>Recent transactions</h3>
      {items.length === 0 ? (
        <p className="summary-subtitle">No recent Neo X transactions are available right now.</p>
      ) : (
        <ul>
          {items.map((transaction) => (
            <li key={transaction.hash}>
              <div>
                <div className="mono">{transaction.shortHash}</div>
                <small>
                  {transaction.timestampLabel}{' '}
                  {transaction.fromHref ? (
                    <a
                      href={transaction.fromHref}
                      rel="noreferrer"
                      target="_blank"
                      title={transaction.fromMeta}
                    >
                      {transaction.fromLabel}
                    </a>
                  ) : (
                    <span title={transaction.fromMeta}>{transaction.fromLabel}</span>
                  )}{' '}
                  to{' '}
                  {transaction.toHref ? (
                    <a
                      href={transaction.toHref}
                      rel="noreferrer"
                      target="_blank"
                      title={transaction.toMeta}
                    >
                      {transaction.toLabel}
                    </a>
                  ) : (
                    <span title={transaction.toMeta}>{transaction.toLabel}</span>
                  )}
                </small>
              </div>
              <div className="asset-address-value">
                <strong>{transaction.methodLabel}</strong>
                <small>
                  {transaction.typeLabel} · {transaction.statusLabel}
                </small>
                <small>Fee {transaction.feeLabel}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TokensList: React.FC<{
  items: NeoXToken[];
}> = ({ items }) => {
  return (
    <div className="list-card neo-x-tokens-list" data-animate style={delayStyle('0.36s')}>
      <h3>Top ERC-20 tokens</h3>
      <p className="summary-subtitle">Current explorer token listing ordered by holder coverage.</p>
      {items.length === 0 ? (
        <p className="summary-subtitle">No ERC-20 token coverage is available right now.</p>
      ) : (
        <div className="neo-x-tokens-scroll">
          <ul>
            {items.map((token) => (
              <li key={token.address}>
                <div>
                  <div>{token.symbol}</div>
                  <small>{token.name}</small>
                  <small className="mono">{token.shortAddress}</small>
                </div>
                <div className="asset-address-value">
                  <strong>{token.holdersLabel} holders</strong>
                  <small>
                    {token.typeLabel} · Supply {token.totalSupplyLabel}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const NeoXPage: React.FC = () => {
  const { theme } = useTheme();
  const data = getPageData<NeoXData>();
  const rangeFrom = data.rangeFrom ?? '';
  const rangeTo = data.rangeTo ?? '';
  const rangeLabel = data.rangeLabel ?? 'Live explorer snapshot';
  const availableRangeLabel = data.availableRangeLabel ?? null;
  const summaryCards = ensureArray(data.summaryCards);
  const recentTransactions = ensureArray(data.recentTransactions);
  const topTokens = ensureArray(data.topTokens);

  useEffect(() => {
    if (data.chartData) {
      initNeoXCharts(data.chartData, theme);
    }
  }, [data.chartData, theme]);

  return (
    <main className="container">
      <Navbar nav={data.nav} marketPrices={data.marketPrices} brandMark="NX" brandHref="/neo-x" />

      <section className="summary-section">
        <div className="summary-header" data-animate style={delayStyle('0.02s')}>
          <div>
            <h2>Neo X overview</h2>
            <p className="summary-subtitle">
              Explorer-backed activity, execution costs, stored transaction history, and current
              token snapshots.
            </p>
          </div>
          <div className="hero-links">
            <span className="pill">{rangeLabel}</span>
            {availableRangeLabel ? (
              <span className="pill">Available {availableRangeLabel}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="range-analytics-section">
        <div className="range-analytics-header" data-animate style={delayStyle('0.06s')}>
          <div>
            <h2>Range analytics</h2>
            <p className="summary-subtitle">
              Filter Neo X transaction history using the currently available history window.
            </p>
          </div>
          <span className="pill">Neo X</span>
        </div>
        <DateRangeForm from={rangeFrom} to={rangeTo} animateDelay="0.08s" />
      </section>

      {data.message ? (
        <section className="empty-state" data-animate style={delayStyle('0.12s')}>
          <h2>
            {data.status === 'error' ? 'Neo X data unavailable' : 'No Neo X activity in this range'}
          </h2>
          <p>{data.message}</p>
        </section>
      ) : null}

      {summaryCards.length > 0 ? <MetricGrid cards={summaryCards} /> : null}

      {data.chartData ? (
        <section className="chart-grid">
          <div className="chart-card full" data-animate style={delayStyle('0.16s')}>
            <div className="chart-title">
              <h3>Daily transactions</h3>
              <span>Per day (range)</span>
            </div>
            <div className="chart-area">
              <canvas id="chart-neox-transactions" className="chart-canvas"></canvas>
            </div>
          </div>
          <div className="chart-card" data-animate style={delayStyle('0.2s')}>
            <div className="chart-title">
              <h3>7-day rolling average</h3>
              <span>Derived from daily transaction counts</span>
            </div>
            <div className="chart-area">
              <canvas id="chart-neox-rolling-average" className="chart-canvas"></canvas>
            </div>
          </div>
          <div className="chart-card" data-animate style={delayStyle('0.24s')}>
            <div className="chart-title">
              <h3>Cumulative transactions</h3>
              <span>Running total in the selected range</span>
            </div>
            <div className="chart-area">
              <canvas id="chart-neox-cumulative" className="chart-canvas"></canvas>
            </div>
          </div>
        </section>
      ) : null}

      <section className="list-grid">
        <RecentTransactionsList items={recentTransactions} />
        <TokensList items={topTokens} />
      </section>
    </main>
  );
};
