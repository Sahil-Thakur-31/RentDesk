/** Ambient floating icons scattered behind the login mascot. Rendered as a fixed layer
 * spanning the whole panel so they never move when the character roams/dodges the cursor. */
const LoginSceneDecor = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute char-float-a" style={{ left: '10%', top: '14%' }}>
      <svg width="30" height="38" viewBox="0 0 30 38" fill="none">
        <path d="M0,20 L15,2 L30,20 Z" fill="#fbbf24" />
        <rect x="3" y="20" width="24" height="18" rx="3" fill="#ffffff" fillOpacity="0.92" />
        <rect x="11" y="28" width="8" height="10" fill="#0b4f47" />
      </svg>
    </div>

    <div className="absolute char-float-b" style={{ right: '9%', top: '10%' }}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <circle cx="17" cy="17" r="17" fill="#fbbf24" />
        <text x="17" y="23" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ffffff">
          {'₹'}
        </text>
      </svg>
    </div>

    <div className="absolute char-float-c" style={{ right: '12%', bottom: '16%' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#ffffff" />
        <path d="M8,16 L14,22 L26,8" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>

    <div className="absolute char-float-a" style={{ left: '12%', bottom: '18%' }}>
      <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
        <rect x="0" y="0" width="28" height="34" rx="4" fill="#ffffff" fillOpacity="0.95" />
        <rect x="6" y="8" width="16" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
        <rect x="6" y="15" width="16" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
        <rect x="6" y="22" width="10" height="3" rx="1.5" fill="#0f766e" fillOpacity="0.55" />
      </svg>
    </div>

    <span className="absolute h-2 w-2 rounded-full bg-white char-sparkle-2" style={{ right: '6%', top: '46%' }} />
    <span className="absolute h-1.5 w-1.5 rounded-full bg-white char-sparkle-3" style={{ left: '6%', top: '46%' }} />
    <span className="absolute h-1.5 w-1.5 rounded-full bg-white char-sparkle-1" style={{ right: '28%', top: '8%' }} />
  </div>
);

export default LoginSceneDecor;
