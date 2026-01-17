import { useState, useEffect, useCallback, useRef } from 'react'

// Realistic Boxing Glove SVG
const BoxingGlove = ({ flip }) => (
  <svg viewBox="0 0 64 64" className="w-5 h-5" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
    <defs>
      <linearGradient id="gloveRed" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#dc2626"/>
        <stop offset="50%" stopColor="#b91c1c"/>
        <stop offset="100%" stopColor="#991b1b"/>
      </linearGradient>
      <linearGradient id="gloveHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444"/>
        <stop offset="100%" stopColor="#dc2626"/>
      </linearGradient>
    </defs>
    {/* Wrist/cuff */}
    <rect x="22" y="48" width="20" height="12" rx="2" fill="#f5f5f4" stroke="#a8a29e" strokeWidth="1"/>
    <line x1="24" y1="52" x2="40" y2="52" stroke="#d6d3d1" strokeWidth="1"/>
    <line x1="24" y1="56" x2="40" y2="56" stroke="#d6d3d1" strokeWidth="1"/>
    {/* Main glove body */}
    <ellipse cx="32" cy="30" rx="22" ry="20" fill="url(#gloveRed)" stroke="#7f1d1d" strokeWidth="1.5"/>
    {/* Thumb */}
    <ellipse cx="12" cy="28" rx="8" ry="10" fill="url(#gloveRed)" stroke="#7f1d1d" strokeWidth="1.5"/>
    {/* Finger padding lines */}
    <path d="M20 18 Q32 12 44 18" fill="none" stroke="#7f1d1d" strokeWidth="1" opacity="0.5"/>
    <path d="M18 26 Q32 20 46 26" fill="none" stroke="#7f1d1d" strokeWidth="1" opacity="0.5"/>
    {/* Highlight */}
    <ellipse cx="38" cy="24" rx="6" ry="4" fill="url(#gloveHighlight)" opacity="0.6"/>
  </svg>
)

// Angry Boss SVG - cartoon style
const AngryBoss = ({ isPunched }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full transition-transform duration-100 ${isPunched ? 'scale-90' : 'scale-100'}`}>
    <circle cx="50" cy="45" r="30" fill={isPunched ? "#ff6b6b" : "#ffd699"} stroke="#333" strokeWidth="2"/>
    <path d="M25 35 Q30 20 50 18 Q70 20 75 35" fill="#4a3728" stroke="#333" strokeWidth="1"/>
    <ellipse cx="50" cy="25" rx="15" ry="8" fill="#ffd699"/>
    <path d="M32 35 L42 40" stroke="#333" strokeWidth="3" strokeLinecap="round"/>
    <path d="M68 35 L58 40" stroke="#333" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="38" cy="42" r="5" fill="white" stroke="#333" strokeWidth="1"/>
    <circle cx="62" cy="42" r="5" fill="white" stroke="#333" strokeWidth="1"/>
    <circle cx={isPunched ? "36" : "38"} cy="42" r="2.5" fill="#333"/>
    <circle cx={isPunched ? "60" : "62"} cy="42" r="2.5" fill="#333"/>
    {isPunched && (
      <>
        <circle cx="30" cy="45" r="4" fill="#ff0000" opacity="0.3"/>
        <circle cx="70" cy="45" r="4" fill="#ff0000" opacity="0.3"/>
        <text x="20" y="25" fontSize="12" fill="#ffcc00">★</text>
        <text x="75" y="25" fontSize="12" fill="#ffcc00">★</text>
      </>
    )}
    <ellipse cx="50" cy="50" rx="4" ry="5" fill="#e6b980" stroke="#333" strokeWidth="1"/>
    <path d={isPunched ? "M38 62 Q50 55 62 62" : "M38 60 Q50 68 62 60"} fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
    {!isPunched && <rect x="42" y="61" width="16" height="6" fill="white" stroke="#333" strokeWidth="1" rx="1"/>}
    <polygon points="50,75 45,85 50,95 55,85" fill="#cc0000" stroke="#333" strokeWidth="1"/>
    <rect x="46" y="73" width="8" height="4" fill="#cc0000" stroke="#333" strokeWidth="1"/>
    <path d="M35 75 L45 78 L50 75 L55 78 L65 75" fill="white" stroke="#333" strokeWidth="1"/>
  </svg>
)

// Realistic Office Background SVG
const OfficeBackground = () => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f5f0e8"/>
        <stop offset="100%" stopColor="#e8e0d0"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#8b7355"/>
        <stop offset="100%" stopColor="#6b5344"/>
      </linearGradient>
      <linearGradient id="deskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#5d4e37"/>
        <stop offset="50%" stopColor="#4a3f2f"/>
        <stop offset="100%" stopColor="#3d3426"/>
      </linearGradient>
      <linearGradient id="windowSky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#87ceeb"/>
        <stop offset="100%" stopColor="#b8d4e8"/>
      </linearGradient>
      <linearGradient id="cabinetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#6b7280"/>
        <stop offset="50%" stopColor="#9ca3af"/>
        <stop offset="100%" stopColor="#6b7280"/>
      </linearGradient>
      <linearGradient id="plantPot" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#b45309"/>
        <stop offset="100%" stopColor="#92400e"/>
      </linearGradient>
    </defs>
    
    {/* Wall */}
    <rect width="400" height="180" fill="url(#wallGrad)"/>
    
    {/* Wainscoting/Lower wall */}
    <rect x="0" y="180" width="400" height="120" fill="url(#floorGrad)"/>
    <rect x="0" y="175" width="400" height="10" fill="#5d4e37"/>
    
    {/* Floor boards pattern */}
    <g opacity="0.3">
      <line x1="0" y1="200" x2="400" y2="200" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="0" y1="230" x2="400" y2="230" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="0" y1="260" x2="400" y2="260" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="50" y1="180" x2="50" y2="300" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="120" y1="180" x2="120" y2="300" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="200" y1="180" x2="200" y2="300" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="280" y1="180" x2="280" y2="300" stroke="#4a3f2f" strokeWidth="1"/>
      <line x1="350" y1="180" x2="350" y2="300" stroke="#4a3f2f" strokeWidth="1"/>
    </g>
    
    {/* Window with frame */}
    <rect x="130" y="25" width="140" height="110" fill="#3d3426" rx="2"/>
    <rect x="135" y="30" width="130" height="100" fill="url(#windowSky)"/>
    {/* Window frame dividers */}
    <rect x="198" y="30" width="4" height="100" fill="#3d3426"/>
    <rect x="135" y="78" width="130" height="4" fill="#3d3426"/>
    {/* Clouds */}
    <ellipse cx="160" cy="50" rx="18" ry="10" fill="white" opacity="0.9"/>
    <ellipse cx="175" cy="48" rx="12" ry="8" fill="white" opacity="0.9"/>
    <ellipse cx="230" cy="55" rx="20" ry="12" fill="white" opacity="0.85"/>
    <ellipse cx="250" cy="52" rx="14" ry="9" fill="white" opacity="0.85"/>
    {/* Distant buildings */}
    <rect x="145" y="95" width="25" height="35" fill="#94a3b8" opacity="0.5"/>
    <rect x="175" y="85" width="20" height="45" fill="#64748b" opacity="0.5"/>
    <rect x="220" y="100" width="30" height="30" fill="#94a3b8" opacity="0.5"/>
    {/* Window sill */}
    <rect x="125" y="135" width="150" height="8" fill="#5d4e37"/>
    
    {/* Framed certificate on wall */}
    <rect x="30" y="40" width="60" height="45" fill="#3d3426" rx="2"/>
    <rect x="34" y="44" width="52" height="37" fill="#fefce8"/>
    <text x="60" y="58" fontSize="6" fill="#1e3a5f" textAnchor="middle" fontWeight="bold">CERTIFICATE</text>
    <text x="60" y="68" fontSize="4" fill="#374151" textAnchor="middle">of Excellence</text>
    <line x1="42" y1="74" x2="78" y2="74" stroke="#1e3a5f" strokeWidth="0.5"/>
    <circle cx="60" cy="74" r="3" fill="#fbbf24" stroke="#b45309" strokeWidth="0.5"/>
    
    {/* Clock on wall */}
    <circle cx="330" cy="55" r="22" fill="#fafafa" stroke="#3d3426" strokeWidth="4"/>
    <circle cx="330" cy="55" r="18" fill="white" stroke="#d1d5db" strokeWidth="1"/>
    {/* Clock numbers */}
    <text x="330" y="42" fontSize="5" fill="#374151" textAnchor="middle">12</text>
    <text x="344" y="58" fontSize="5" fill="#374151" textAnchor="middle">3</text>
    <text x="330" y="72" fontSize="5" fill="#374151" textAnchor="middle">6</text>
    <text x="316" y="58" fontSize="5" fill="#374151" textAnchor="middle">9</text>
    {/* Clock hands */}
    <line x1="330" y1="55" x2="330" y2="42" stroke="#1f2937" strokeWidth="2" strokeLinecap="round"/>
    <line x1="330" y1="55" x2="342" y2="55" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="330" cy="55" r="2" fill="#1f2937"/>
    
    {/* Executive desk */}
    <rect x="80" y="195" width="240" height="12" fill="url(#deskGrad)" rx="1"/>
    <rect x="85" y="207" width="8" height="50" fill="#3d3426"/>
    <rect x="307" y="207" width="8" height="50" fill="#3d3426"/>
    {/* Desk drawer panel */}
    <rect x="140" y="207" width="120" height="35" fill="#4a3f2f" stroke="#3d3426" strokeWidth="1"/>
    <rect x="145" y="212" width="50" height="12" fill="#3d3426" rx="1"/>
    <circle cx="170" cy="218" r="2" fill="#d4af37"/>
    <rect x="205" y="212" width="50" height="12" fill="#3d3426" rx="1"/>
    <circle cx="230" cy="218" r="2" fill="#d4af37"/>
    <rect x="145" y="227" width="110" height="12" fill="#3d3426" rx="1"/>
    <circle cx="200" cy="233" r="2" fill="#d4af37"/>
    
    {/* Computer monitor */}
    <rect x="170" y="155" width="60" height="40" rx="3" fill="#1f2937"/>
    <rect x="173" y="158" width="54" height="32" fill="#3b82f6"/>
    {/* Screen content - spreadsheet */}
    <rect x="176" y="161" width="48" height="26" fill="#1e3a5f"/>
    <line x1="176" y1="168" x2="224" y2="168" stroke="#3b82f6" strokeWidth="0.5"/>
    <line x1="176" y1="175" x2="224" y2="175" stroke="#3b82f6" strokeWidth="0.5"/>
    <line x1="176" y1="182" x2="224" y2="182" stroke="#3b82f6" strokeWidth="0.5"/>
    <line x1="192" y1="161" x2="192" y2="187" stroke="#3b82f6" strokeWidth="0.5"/>
    <line x1="208" y1="161" x2="208" y2="187" stroke="#3b82f6" strokeWidth="0.5"/>
    {/* Monitor stand */}
    <rect x="195" y="195" width="10" height="5" fill="#374151"/>
    <rect x="188" y="198" width="24" height="3" fill="#4b5563" rx="1"/>
    
    {/* Keyboard */}
    <rect x="175" y="200" width="50" height="12" rx="2" fill="#1f2937"/>
    <rect x="178" y="202" width="44" height="8" fill="#374151" rx="1"/>
    
    {/* Coffee mug */}
    <ellipse cx="270" cy="192" rx="10" ry="4" fill="#7c2d12"/>
    <rect x="260" y="178" width="20" height="14" rx="2" fill="white" stroke="#d1d5db" strokeWidth="1"/>
    <ellipse cx="270" cy="180" rx="8" ry="3" fill="#92400e"/>
    <path d="M280 182 Q288 186 280 192" fill="none" stroke="#d1d5db" strokeWidth="2"/>
    {/* Steam */}
    <path d="M266 175 Q264 170 268 168" fill="none" stroke="#d1d5db" strokeWidth="1" opacity="0.6"/>
    <path d="M272 173 Q274 168 270 165" fill="none" stroke="#d1d5db" strokeWidth="1" opacity="0.6"/>
    
    {/* Stack of papers */}
    <rect x="120" y="188" width="35" height="2" fill="#f5f5f5" stroke="#e5e7eb" strokeWidth="0.5"/>
    <rect x="121" y="186" width="35" height="2" fill="#fafafa" stroke="#e5e7eb" strokeWidth="0.5"/>
    <rect x="122" y="184" width="35" height="2" fill="white" stroke="#e5e7eb" strokeWidth="0.5"/>
    
    {/* Pen holder */}
    <rect x="295" y="180" width="15" height="18" fill="#374151" rx="2"/>
    <line x1="298" y1="180" x2="296" y2="168" stroke="#3b82f6" strokeWidth="2"/>
    <line x1="302" y1="180" x2="303" y2="165" stroke="#1f2937" strokeWidth="2"/>
    <line x1="306" y1="180" x2="308" y2="170" stroke="#dc2626" strokeWidth="2"/>
    
    {/* Filing cabinet */}
    <rect x="20" y="160" width="45" height="90" fill="url(#cabinetGrad)" stroke="#4b5563" strokeWidth="1" rx="2"/>
    <rect x="24" y="165" width="37" height="25" fill="#4b5563" stroke="#374151" strokeWidth="1" rx="1"/>
    <rect x="38" y="175" width="10" height="4" fill="#9ca3af" rx="1"/>
    <rect x="24" y="195" width="37" height="25" fill="#4b5563" stroke="#374151" strokeWidth="1" rx="1"/>
    <rect x="38" y="205" width="10" height="4" fill="#9ca3af" rx="1"/>
    <rect x="24" y="225" width="37" height="25" fill="#4b5563" stroke="#374151" strokeWidth="1" rx="1"/>
    <rect x="38" y="235" width="10" height="4" fill="#9ca3af" rx="1"/>
    
    {/* Potted plant */}
    <rect x="345" y="210" width="35" height="40" fill="url(#plantPot)" rx="3"/>
    <rect x="342" y="205" width="41" height="8" fill="#b45309" rx="2"/>
    <ellipse cx="362" cy="208" rx="16" ry="4" fill="#78350f"/>
    {/* Plant leaves */}
    <ellipse cx="362" cy="175" rx="20" ry="25" fill="#166534"/>
    <ellipse cx="350" cy="180" rx="15" ry="20" fill="#15803d"/>
    <ellipse cx="375" cy="178" rx="14" ry="18" fill="#14532d"/>
    <ellipse cx="362" cy="165" rx="12" ry="15" fill="#22c55e"/>
    <ellipse cx="355" cy="172" rx="8" ry="12" fill="#16a34a"/>
    <ellipse cx="370" cy="170" rx="10" ry="14" fill="#15803d"/>
    
    {/* Bookshelf on right wall */}
    <rect x="335" y="40" width="50" height="80" fill="#5d4e37" stroke="#3d3426" strokeWidth="2"/>
    <rect x="338" y="45" width="44" height="18" fill="#4a3f2f"/>
    <rect x="340" y="48" width="10" height="14" fill="#1e40af"/>
    <rect x="352" y="48" width="8" height="14" fill="#dc2626"/>
    <rect x="362" y="48" width="10" height="14" fill="#15803d"/>
    <rect x="374" y="50" width="6" height="12" fill="#7c3aed"/>
    <rect x="338" y="68" width="44" height="18" fill="#4a3f2f"/>
    <rect x="340" y="71" width="12" height="14" fill="#b45309"/>
    <rect x="354" y="71" width="8" height="14" fill="#0891b2"/>
    <rect x="364" y="73" width="10" height="12" fill="#be185d"/>
    <rect x="338" y="91" width="44" height="18" fill="#4a3f2f"/>
    <rect x="341" y="94" width="8" height="12" fill="#4b5563"/>
    <rect x="351" y="94" width="12" height="12" fill="#1f2937"/>
    <rect x="365" y="96" width="8" height="10" fill="#7c2d12"/>
  </svg>
)

// Punch effect burst
const PunchBurst = ({ x, y }) => (
  <div 
    className="absolute pointer-events-none animate-ping"
    style={{ left: x - 20, top: y - 20 }}
  >
    <svg width="40" height="40" viewBox="0 0 50 50">
      <polygon points="25,5 30,20 45,20 33,30 38,45 25,35 12,45 17,30 5,20 20,20" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2"/>
    </svg>
  </div>
)

export default function PunchTheManager({ isVisible, processingProgress, processingStatus }) {
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [bossPosition, setBossPosition] = useState({ x: 50, y: 50 })
  const [isPunched, setIsPunched] = useState(false)
  const [punches, setPunches] = useState([])
  const [bossSpeed, setBossSpeed] = useState(2000)
  const gameAreaRef = useRef(null)
  const punchIdRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem('punchTheManager_highScore')
    if (saved) setHighScore(parseInt(saved, 10))
  }, [])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('punchTheManager_highScore', score.toString())
    }
  }, [score, highScore])

  useEffect(() => {
    if (isVisible) {
      setScore(0)
      setBossSpeed(2000)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    
    const moveBoss = () => {
      const newX = 15 + Math.random() * 70
      const newY = 15 + Math.random() * 60
      setBossPosition({ x: newX, y: newY })
    }

    moveBoss()
    const interval = setInterval(moveBoss, bossSpeed)
    return () => clearInterval(interval)
  }, [isVisible, bossSpeed])

  useEffect(() => {
    const newSpeed = Math.max(800, 2000 - (score * 50))
    setBossSpeed(newSpeed)
  }, [score])

  const handlePunch = useCallback((e) => {
    if (!gameAreaRef.current) return
    
    const rect = gameAreaRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    const clickY = ((e.clientY - rect.top) / rect.height) * 100
    
    const distance = Math.sqrt(
      Math.pow(clickX - bossPosition.x, 2) + 
      Math.pow(clickY - bossPosition.y, 2)
    )
    
    if (distance < 18) {
      setScore(s => s + 1)
      setIsPunched(true)
      
      const punchId = punchIdRef.current++
      setPunches(p => [...p, { id: punchId, x: e.clientX - rect.left, y: e.clientY - rect.top }])
      
      setTimeout(() => {
        setPunches(p => p.filter(punch => punch.id !== punchId))
      }, 500)
      
      setTimeout(() => {
        setIsPunched(false)
        const newX = 15 + Math.random() * 70
        const newY = 15 + Math.random() * 60
        setBossPosition({ x: newX, y: newY })
      }, 200)
    }
  }, [bossPosition])

  if (!isVisible) return null

  return (
    <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center z-50 p-3">
      {/* Intro text */}
      <p className="text-slate-400 text-xs mb-1">While you wait for your results, please enjoy a quick game of</p>
      
      {/* Title with boxing gloves */}
      <div className="flex items-center gap-2 mb-3">
        <BoxingGlove />
        <h2 className="text-slate-200 text-sm font-medium tracking-wide">Punch the Manager</h2>
        <BoxingGlove flip />
      </div>

      {/* Game Container */}
      <div className="flex flex-col" style={{ width: '320px' }}>
        {/* Score bar attached to top of game */}
        <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-t-lg border border-slate-600 border-b-0">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs">Score:</span>
            <span className="text-green-400 text-sm font-bold">{score}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs">Best:</span>
            <span className="text-yellow-400 text-sm font-bold">{highScore}</span>
          </div>
        </div>

        {/* Game Area */}
        <div 
          ref={gameAreaRef}
          className="relative overflow-hidden cursor-crosshair border border-slate-600 border-t-0"
          onClick={handlePunch}
          style={{ width: '320px', height: '240px' }}
        >
          {/* Realistic office background */}
          <OfficeBackground />
          
          {/* Boss */}
          <div 
            className="absolute transition-all duration-300 ease-out w-16 h-16"
            style={{ 
              left: `${bossPosition.x}%`, 
              top: `${bossPosition.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <AngryBoss isPunched={isPunched} />
          </div>

          {/* Punch effects */}
          {punches.map(punch => (
            <PunchBurst key={punch.id} x={punch.x} y={punch.y} />
          ))}

          {/* Instructions overlay */}
          {score === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 px-3 py-1.5 rounded">
                <p className="text-white text-sm">Click the manager!</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar attached to bottom */}
        <div className="bg-slate-900 px-3 py-2 rounded-b-lg border border-slate-600 border-t-0">
          <p className="text-slate-400 text-xs text-center mb-1.5 truncate">{processingStatus || 'Processing...'}</p>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
              style={{width: `${processingProgress}%`}}
            />
          </div>
          <p className="text-slate-500 text-[10px] text-center mt-1">{processingProgress}%</p>
        </div>
      </div>
    </div>
  )
}
