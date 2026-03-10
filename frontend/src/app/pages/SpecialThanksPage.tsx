import type React from 'react';
import { Navbar } from '../components/Navbar';
import { delayStyle, getPageData } from '../utils';
import type { DashboardData } from '../types';

export const SpecialThanksPage: React.FC = () => {
  const data = getPageData<DashboardData>();

  return (
    <main className="container">
      <Navbar nav={data.nav} />

      <header className="hero" data-animate style={delayStyle('0s')}>
        <div>
          <h1>Special thanks</h1>
          <p className="subtitle">
            A longer thank-you to the teams, builders, and community members who keep Neo N3 moving.
          </p>
        </div>
      </header>

      <section className="list-grid">
        <div className="list-card" data-animate style={delayStyle('0.1s')}>
          <h3>City of Zion (CoZ)</h3>
          <p>
            Deep thanks to{' '}
            <a href="https://github.com/CityOfZion" target="_blank" rel="noreferrer">
              CityOfZion
            </a>{' '}
            for providing the{' '}
            <a
              href="https://www.npmjs.com/package/@cityofzion/neon-js"
              target="_blank"
              rel="noreferrer"
            >
              neon-js
            </a>{' '}
            SDK and the public{' '}
            <a href="https://dora.coz.io/monitor" target="_blank" rel="noreferrer">
              Nodes monitor
            </a>{' '}
            that made this project possible. These tools are the backbone for querying, decoding,
            and summarizing Neo N3 activity in a reliable way.
          </p>
          <p>
            The daily ingestion pipeline and classification rules depend on that steady foundation,
            and it is hugely appreciated.
          </p>
        </div>
        <div className="list-card" data-animate style={delayStyle('0.15s')}>
          <h3>Neo builders</h3>
          <p>
            Special thanks to every Neo builder who cares about the Neo N3 chain. Wallet teams,
            explorers, indexers, infra maintainers, and dApp authors keep the ecosystem visible,
            usable, and moving forward.
          </p>
          <p>
            We are still waiting for the one killer dApp that will drive mass adoption, but every
            contribution matters
          </p>
        </div>
      </section>
    </main>
  );
};
