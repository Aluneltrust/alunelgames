import { useEffect } from 'react';

export type LegalDoc = 'terms' | 'privacy';

interface LegalPageProps {
  doc: LegalDoc;
  onClose: () => void;
}

export function LegalPage({ doc, onClose }: LegalPageProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[wpFadeIn_0.18s_ease]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel-bezel w-full max-w-2xl max-h-[85vh] relative flex flex-col">
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-black border border-amber-500/40 text-amber-300/80 hover:text-amber-200 hover:border-amber-400 flex items-center justify-center text-sm transition-all"
          aria-label="Close"
        >
          ×
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-6 pt-6 pb-3 border-b border-amber-500/15">
            <h1 className="text-base font-bold tracking-[0.25em] uppercase bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
              {doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </h1>
            <p className="text-[10px] text-amber-700/60 mt-1 tracking-wide uppercase">Last updated: April 2026</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 text-xs leading-relaxed text-gray-300 space-y-4">
            {doc === 'terms' ? <TermsContent /> : <PrivacyContent />}
          </div>

          <div className="px-6 py-4 border-t border-amber-500/15">
            <button
              onClick={onClose}
              className="btn-bezel btn-bezel-sm btn-bezel-hairline uppercase w-full"
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-amber-400 mt-5 mb-2">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-gray-300 leading-relaxed">{children}</p>;
}

function TermsContent() {
  return (
    <>
      <P>
        Welcome to <strong className="text-amber-300">ALUNEL Games</strong>. By connecting a wallet and using any game on this
        platform, you agree to the terms below. Please read them carefully.
      </P>

      <H>1. Play at Your Own Risk</H>
      <P>
        All games on ALUNEL Games involve real BSV (Bitcoin SV) transactions. Funds staked, wagered, or
        deposited into game escrows are <strong className="text-amber-300">at risk of loss</strong>. Outcomes
        depend on gameplay, opponents, timing, and blockchain network conditions.
        <br /><br />
        <strong className="text-amber-300">We strongly recommend starting with the smallest stake tier</strong> until you are
        comfortable with each game's mechanics. Only play with amounts you can afford to lose.
      </P>

      <H>2. Wallet & Custody</H>
      <P>
        You control your own private keys. ALUNEL Games does not hold, custody, or have access to your
        primary wallet funds. Encrypted local wallets are stored in your browser and protected by a PIN you
        set — we cannot recover this PIN. Loss of the PIN and backup may mean permanent loss of funds.
      </P>

      <H>3. Game Escrows</H>
      <P>
        Some games require deposits into per-game escrow wallets controlled by the game server. These
        escrows are used exclusively for in-game settlement (wins, payouts, platform fees). Escrow rules,
        payout schedules, and forfeiture conditions are defined per game and shown before you enter a match.
      </P>

      <H>4. Forfeiture</H>
      <P>
        If you withdraw from a game in progress, forfeit, or disconnect beyond the grace period, you may
        lose any funds you deposited into the game's escrow. Turn timeouts and normal game-end conditions
        follow the rules displayed inside each game.
      </P>

      <H>5. Platform Fees</H>
      <P>
        ALUNEL Games may take a percentage of game pots and winnings as a platform fee. The fee percentage
        is shown before each game begins.
      </P>

      <H>6. No Warranty</H>
      <P>
        The platform and games are provided <strong className="text-amber-300">"as is"</strong> with no
        warranties of uptime, fairness verification, or protection against network issues, bugs, exploits,
        or third-party failures. Blockchain transactions are irreversible. We are not liable for lost
        funds, missed payouts, network congestion, or game disruptions.
      </P>

      <H>7. Prohibited Conduct</H>
      <P>
        You agree not to: exploit bugs, use bots or automation, collude with opponents, harass other players,
        or attempt to compromise the platform's security. Violations may result in account suspension and
        forfeiture of in-game funds.
      </P>

      <H>8. Age & Jurisdiction</H>
      <P>
        You must be of legal age in your jurisdiction to use real-money gaming applications. You are
        responsible for ensuring your use of this platform complies with local laws. ALUNEL Games is not
        available in jurisdictions where such applications are prohibited.
      </P>

      <H>9. Changes to These Terms</H>
      <P>
        These terms may be updated at any time. Continued use of the platform after changes constitutes
        acceptance.
      </P>

      <H>10. Contact</H>
      <P>For questions or disputes, contact the ALUNEL Games team at the support channel listed on the platform.</P>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <P>
        This Privacy Policy explains what data <strong className="text-amber-300">ALUNEL Games</strong> collects, how it is used,
        and what rights you have.
      </P>

      <H>1. What We Collect</H>
      <P>
        <strong className="text-amber-300">On-device:</strong> Encrypted wallet key (protected by your PIN), username,
        theme preference. Stored only in your browser's local storage. Never transmitted.
        <br /><br />
        <strong className="text-amber-300">On-chain:</strong> Your public BSV address, transaction history, and game
        actions that you sign and broadcast. These are public by nature of the BSV blockchain.
        <br /><br />
        <strong className="text-amber-300">Server-side (per game):</strong> Socket connection metadata, game results,
        win/loss records, match history. No IP logging beyond standard server operational needs.
      </P>

      <H>2. What We Do Not Collect</H>
      <P>
        We do not collect: names, emails, phone numbers, payment details, government IDs, geolocation, or
        third-party tracking identifiers. We do not use advertising cookies or ad networks.
      </P>

      <H>3. How We Use Data</H>
      <P>
        Collected data is used solely to: run the games, settle escrows, show match history and leaderboards,
        and debug/secure the platform. We do not sell, rent, or share data with marketers.
      </P>

      <H>4. Third Parties</H>
      <P>
        We use the BSV blockchain (public ledger), WhatsOnChain / GorillaPool for transaction lookups, and
        standard cloud providers (Vercel, Railway) to host the platform. These providers may log routine
        request metadata per their own policies.
      </P>

      <H>5. Your Keys, Your Funds</H>
      <P>
        You are responsible for securing your wallet PIN and private keys. If you lose them, we cannot
        recover your funds. We do not maintain a copy of your keys.
      </P>

      <H>6. Data Retention</H>
      <P>
        On-chain data is permanent. Server-side match records may be retained indefinitely for platform
        statistics and dispute resolution.
      </P>

      <H>7. Children</H>
      <P>
        The platform is not intended for use by minors. Users must be of legal age in their jurisdiction.
      </P>

      <H>8. Changes</H>
      <P>
        This policy may be updated. The "Last updated" date above reflects the latest revision.
      </P>

      <H>9. Contact</H>
      <P>For privacy questions, contact the ALUNEL Games team at the support channel listed on the platform.</P>
    </>
  );
}
