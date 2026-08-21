import { useId } from 'react';

export type CharacterMood = 'idle' | 'watching' | 'hiding' | 'peeking' | 'thinking' | 'error' | 'offline' | 'success' | 'poked' | 'cornered';

interface LoginCharacterProps {
  mood?: CharacterMood;
  /** -1..1, eyes/pupils track this point (cursor or focused input) */
  gazeX?: number;
  gazeY?: number;
  /** bump this to restart the poke animation even if mood was already 'poked' */
  pokeKey?: number;
  onClick?: () => void;
  /** Render the floating decorative icons (house/coin/check/doc) inside this SVG. Turn off when the
   * character roams within a larger fixed backdrop that already renders its own decorations, so the
   * icons don't move together with the character. */
  decor?: boolean;
}

const EYE_L_CX = 155.5;
const EYE_R_CX = 184.5;
const EYE_CY = 196.5;
const PUPIL_MAX_X = 2.2;
const PUPIL_MAX_Y = 3.4;

const LoginCharacter = ({ mood = 'idle', gazeX = 0, gazeY = 0, pokeKey = 0, onClick, decor = true }: LoginCharacterProps) => {
  const uid = useId();
  const bodyGradId = `char-body-${uid}`;
  const faceGradId = `char-face-${uid}`;
  const highlightId = `char-highlight-${uid}`;
  const gx = Math.max(-1, Math.min(1, gazeX));
  const gy = Math.max(-1, Math.min(1, gazeY));
  const pupilX = gx * PUPIL_MAX_X;
  const pupilY = gy * PUPIL_MAX_Y;
  const tracksGaze = mood === 'idle' || mood === 'watching' || mood === 'peeking';

  const arms = (() => {
    if (mood === 'hiding') {
      return (
        <>
          <path d="M124,205 Q110,185 151,193" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="151" cy="194" r="15" fill="#ffffff" />
          <path d="M216,205 Q230,185 189,193" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="189" cy="194" r="15" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'peeking') {
      return (
        <>
          <path d="M124,205 Q112,196 149,213" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="149" cy="214" r="14" fill="#ffffff" />
          <path d="M216,205 Q228,196 191,213" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="191" cy="214" r="14" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'error') {
      return (
        <>
          <path d="M124,200 Q90,196 80,212" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="80" cy="214" r="12" fill="#ffffff" />
          <path d="M216,200 Q250,196 260,212" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="260" cy="214" r="12" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'success') {
      return (
        <>
          <path d="M124,205 Q100,160 90,118" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="90" cy="116" r="12" fill="#ffffff" />
          <path d="M216,205 Q240,160 250,118" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="250" cy="116" r="12" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'poked') {
      return (
        <>
          <path d="M124,203 Q92,180 76,140" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="74" cy="136" r="12" fill="#ffffff" />
          <path d="M216,203 Q248,180 264,140" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="266" cy="136" r="12" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'cornered') {
      return (
        <>
          <path d="M124,208 Q140,196 166,206" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="168" cy="208" r="14" fill="#ffffff" />
          <path d="M216,208 Q200,196 174,206" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" />
          <circle cx="172" cy="208" r="14" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'idle') {
      return (
        <>
          <path d="M124,205 Q95,220 92,258" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" fill="none" />
          <circle cx="92" cy="261" r="13" fill="#ffffff" />
          <g className="char-wave" style={{ transformOrigin: '216px 200px' }}>
            <path d="M216,205 Q245,190 248,150" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" fill="none" />
            <circle cx="248" cy="148" r="13" fill="#ffffff" />
          </g>
        </>
      );
    }
    return (
      <>
        <path d="M124,205 Q95,220 92,258" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" fill="none" />
        <circle cx="92" cy="261" r="13" fill="#ffffff" />
        <path d="M216,205 Q245,220 248,258" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" fill="none" />
        <circle cx="248" cy="261" r="13" fill="#ffffff" />
      </>
    );
  })();

  const eyes = (() => {
    if (mood === 'thinking') {
      return (
        <>
          <rect x="149" y="195" width="12" height="3" rx="1.5" fill="#ffffff" />
          <rect x="178" y="195" width="12" height="3" rx="1.5" fill="#ffffff" />
        </>
      );
    }
    if (mood === 'offline') {
      return (
        <>
          <circle cx="156" cy="197" r="4" fill="#ffffff" />
          <circle cx="184" cy="197" r="4" fill="#ffffff" />
          <path d="M156,190 a7,7 0 1 1 -6,4" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" className="char-spin-slow" style={{ transformOrigin: '156px 197px' }} />
          <path d="M184,190 a7,7 0 1 1 -6,4" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" className="char-spin-slow" style={{ transformOrigin: '184px 197px' }} />
        </>
      );
    }
    if (mood === 'error') {
      return (
        <g>
          <path d="M148,188 L161,192" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M192,188 L179,192" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="151" y="192" width="9" height="12" rx="4.5" fill="#ffffff" />
          <rect x="180" y="192" width="9" height="12" rx="4.5" fill="#ffffff" />
        </g>
      );
    }
    if (mood === 'success') {
      return (
        <>
          <path d="M148,200 Q155,190 162,200" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M178,200 Q185,190 192,200" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (mood === 'poked') {
      return (
        <>
          <circle cx="155.5" cy="196.5" r="7" fill="#ffffff" />
          <circle cx="184.5" cy="196.5" r="7" fill="#ffffff" />
          <circle cx="155.5" cy="196.5" r="3.4" fill="#0b4f47" />
          <circle cx="184.5" cy="196.5" r="3.4" fill="#0b4f47" />
        </>
      );
    }
    if (mood === 'cornered') {
      return (
        <>
          <path d="M149,196 Q155.5,190 162,196" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M178,196 Q184.5,190 191,196" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    }
    // idle / watching / hiding / peeking — eyes with pupils that track gaze
    const pupilTransform = tracksGaze ? `translate(${pupilX}px, ${pupilY}px)` : 'translate(0px, 0px)';
    return (
      <g className="char-blink" style={{ transformOrigin: '170px 197px' }}>
        <rect x="151" y="190" width="9" height="13" rx="4.5" fill="#ffffff" />
        <rect x="180" y="190" width="9" height="13" rx="4.5" fill="#ffffff" />
        <circle cx={EYE_L_CX} cy={EYE_CY} r="2.3" fill="#0b4f47" className="char-pupil" style={{ transform: pupilTransform }} />
        <circle cx={EYE_R_CX} cy={EYE_CY} r="2.3" fill="#0b4f47" className="char-pupil" style={{ transform: pupilTransform }} />
      </g>
    );
  })();

  const mouth = (() => {
    if (mood === 'thinking') return <path d="M156,218 L184,218" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />;
    if (mood === 'error') return <path d="M150,224 Q170,210 190,224" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />;
    if (mood === 'offline') return <path d="M148,218 Q156,224 164,218 Q172,212 180,218 Q188,224 194,218" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />;
    if (mood === 'success') return <path d="M144,210 Q170,240 196,210" stroke="#ffffff" strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    if (mood === 'peeking') return <circle cx="170" cy="217" r="5" fill="none" stroke="#ffffff" strokeWidth="3" />;
    if (mood === 'poked') return <ellipse cx="170" cy="218" rx="7" ry="9" fill="#ffffff" />;
    if (mood === 'cornered') return <path d="M163,220 Q170,216 177,220" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />;
    return <path d="M150,214 Q170,226 190,214" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />;
  })();

  const antenna = (() => {
    if (mood === 'offline' || mood === 'cornered') {
      return (
        <g className="char-droop" opacity="0.55">
          <path d="M170,140 Q180,126 173,113" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="173" cy="112" r="6" fill="#fbbf24" />
        </g>
      );
    }
    const glowClass = mood === 'thinking' || mood === 'success' ? 'char-pulse-fast' : 'char-sparkle-1';
    const glowR = mood === 'success' ? 18 : 14;
    return (
      <>
        <line x1="170" y1="140" x2="170" y2="115" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
        <circle cx="170" cy="108" r={glowR} fill="#fbbf24" opacity="0.25" className={glowClass} />
        <circle cx="170" cy="108" r="7" fill="#fbbf24" />
      </>
    );
  })();

  const bobClass = mood === 'success' ? 'char-bounce-happy' : mood === 'cornered' ? 'char-tremble' : 'char-bob';
  const bodyX = tracksGaze ? gx * 7 : 0;
  const bodyY = tracksGaze ? gy * 5 : 0;
  const bodyRot = tracksGaze ? gx * 11 : 0;

  return (
    <svg
      viewBox="0 0 340 420"
      className={`w-full h-full ${onClick ? 'cursor-pointer' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Friendly RentDesk mascot"
      onClick={onClick}
    >
      <defs>
        <linearGradient id={bodyGradId} x1="15%" y1="10%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f2f7f7" />
          <stop offset="100%" stopColor="#cfe0e0" />
        </linearGradient>
        <linearGradient id={faceGradId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#12564f" />
          <stop offset="100%" stopColor="#082e2a" />
        </linearGradient>
        <radialGradient id={highlightId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {decor && (
        <>
          <g className="char-float-a" style={{ transformOrigin: '50px 80px' }}>
            <path d="M35,86 L50,68 L65,86 Z" fill="#fbbf24" />
            <rect x="38" y="86" width="24" height="20" rx="3" fill="#ffffff" fillOpacity="0.92" />
            <rect x="46" y="96" width="8" height="10" fill="#0b4f47" />
          </g>

          <g className="char-float-b" style={{ transformOrigin: '280px 95px' }}>
            <circle cx="280" cy="95" r="17" fill="#fbbf24" />
            <text x="280" y="101" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ffffff">
              {'₹'}
            </text>
          </g>

          <g className="char-float-c" style={{ transformOrigin: '270px 292px' }}>
            <circle cx="270" cy="292" r="16" fill="#ffffff" />
            <path d="M262,292 L268,298 L280,284" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>

          <g className="char-float-a" style={{ transformOrigin: '58px 275px' }}>
            <rect x="45" y="258" width="28" height="34" rx="4" fill="#ffffff" fillOpacity="0.95" />
            <rect x="51" y="266" width="16" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
            <rect x="51" y="273" width="16" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
            <rect x="51" y="280" width="10" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
          </g>

          <circle cx="300" cy="200" r="4" fill="#ffffff" className="char-sparkle-2" />
          <circle cx="30" cy="200" r="3" fill="#ffffff" className="char-sparkle-3" />
          <circle cx="245" cy="60" r="3" fill="#ffffff" className="char-sparkle-1" />
        </>
      )}

      <ellipse cx="170" cy="378" rx="66" ry="13" fill="rgba(255,255,255,0.28)" className="char-shadow-pulse" />

      {mood === 'poked' && (
        <g key={`burst-${pokeKey}`} className="char-poke-burst" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
          <line x1="170" y1="60" x2="170" y2="40" />
          <line x1="146" y1="68" x2="130" y2="52" />
          <line x1="194" y1="68" x2="210" y2="52" />
        </g>
      )}

      <g key={`bob-${pokeKey}`} className={`${bobClass} ${mood === 'error' ? 'char-shake-anim' : ''} ${mood === 'poked' ? 'char-poke-anim' : ''}`}>
        <g
          className="char-gaze-group"
          style={{ transform: `translate(${bodyX}px, ${bodyY}px) rotate(${bodyRot}deg)`, transformOrigin: '170px 300px' }}
        >
          <rect x="115" y="140" width="110" height="170" rx="55" fill={`url(#${bodyGradId})`} stroke="rgba(15,118,110,0.18)" strokeWidth="2" />
          <ellipse cx="146" cy="172" rx="26" ry="34" fill={`url(#${highlightId})`} transform="rotate(-18 146 172)" />
          <path d="M120,235 Q170,255 220,235 L220,285 Q170,300 120,285 Z" fill="#0f172a" opacity="0.05" />

          {antenna}
          <rect x="133" y="170" width="74" height="58" rx="18" fill={`url(#${faceGradId})`} />
          {eyes}
          {mouth}

          {arms}
        </g>
      </g>
    </svg>
  );
};

export default LoginCharacter;
