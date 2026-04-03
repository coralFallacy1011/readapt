import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// ─── Floating 3-D word that cycles through sample words ───────────────────────
function RSVPDemo() {
  const words = ['Read.', 'Faster.', 'Smarter.', 'Deeper.', 'Further.']
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % words.length)
        setVisible(true)
      }, 200)
    }, 700)
    return () => clearInterval(t)
  }, [])

  const word = words[idx]
  const orp = Math.floor(word.length / 3)

  return (
    <div className="relative flex items-center justify-center h-28 select-none">
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.92)',
          display: 'inline-block',
        }}
      >
        <span style={{ color: '#e5e5e5' }}>{word.slice(0, orp)}</span>
        <span style={{ color: '#f97316', textShadow: '0 0 24px #f9731680' }}>{word[orp]}</span>
        <span style={{ color: '#e5e5e5' }}>{word.slice(orp + 1)}</span>
      </span>
    </div>
  )
}

// ─── Tilt card ─────────────────────────────────────────────────────────────────
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.03)`
  }

  function onLeave() {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: 'transform 0.25s ease', transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </div>
  )
}

// ─── Floating orb background ───────────────────────────────────────────────────
function Orbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%',
        width: '55vw', height: '55vw', borderRadius: '50%',
        background: 'radial-gradient(circle, #f9731618 0%, transparent 70%)',
        animation: 'drift1 18s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '60vw', height: '60vw', borderRadius: '50%',
        background: 'radial-gradient(circle, #7c3aed18 0%, transparent 70%)',
        animation: 'drift2 22s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '40%',
        width: '30vw', height: '30vw', borderRadius: '50%',
        background: 'radial-gradient(circle, #06b6d412 0%, transparent 70%)',
        animation: 'drift1 14s ease-in-out infinite alternate-reverse',
      }} />
    </div>
  )
}

// ─── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 'clamp(1.8rem, 4vw, 3rem)',
      fontWeight: 800,
      background: 'linear-gradient(135deg, #f97316, #facc15)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '1rem',
    }}>
      {children}
    </h2>
  )
}

// ─── Feature card data ─────────────────────────────────────────────────────────
const features = [
  {
    icon: '⚡',
    title: 'RSVP Engine',
    desc: 'One word at a time, flashed at your chosen speed — from 100 to 1000 WPM. Your brain adapts faster than you think.',
  },
  {
    icon: '🎯',
    title: 'ORP Highlighting',
    desc: 'The Optimal Recognition Point is the exact letter your eye locks onto. We highlight it in orange so every word registers instantly.',
  },
  {
    icon: '📄',
    title: 'PDF Upload',
    desc: 'Drop any PDF — textbooks, research papers, novels. We extract, clean, and serve every word ready for speed reading.',
  },
  {
    icon: '💾',
    title: 'Progress Tracking',
    desc: 'Close the tab, come back later. Your position, WPM, and time spent are saved automatically every 5 seconds.',
  },
  {
    icon: '📊',
    title: 'Reading Analytics',
    desc: 'See total words read, books uploaded, and your last session stats — a clear picture of your reading habit over time.',
  },
  {
    icon: '🔒',
    title: 'Secure by Default',
    desc: 'JWT auth, bcrypt-hashed passwords, and per-user data isolation. Your library is yours alone.',
  },
]

// ─── Main landing page ─────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes drift1 { from { transform: translate(0,0) } to { transform: translate(4vw, 6vh) } }
        @keyframes drift2 { from { transform: translate(0,0) } to { transform: translate(-5vw, -4vh) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin3d { from { transform: rotateY(0deg) } to { transform: rotateY(360deg) } }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }
        .fade-up-4 { animation-delay: 0.55s; }
        .grid-line {
          background-image:
            linear-gradient(rgba(249,115,22,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(249,115,22,0.07) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>

      <Orbs />

      <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#e5e5e5', overflowX: 'hidden' }}>

        {/* ── NAV ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(249,115,22,0.12)',
          padding: '0 2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '64px',
        }}>
          <span style={{ fontWeight: 900, fontSize: '1.4rem', color: '#f97316', letterSpacing: '-0.03em' }}>
            Readapt
          </span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="#features" style={{ color: '#9ca3af', fontSize: '0.875rem', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
              Features
            </a>
            <a href="#about" style={{ color: '#9ca3af', fontSize: '0.875rem', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
              About
            </a>
            <Link to="/login" style={{
              color: '#9ca3af', fontSize: '0.875rem', textDecoration: 'none',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
              Sign in
            </Link>
            <Link to="/register" style={{
              background: '#f97316', color: '#fff', fontWeight: 700,
              padding: '0.4rem 1.1rem', borderRadius: '8px', fontSize: '0.875rem',
              textDecoration: 'none', transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}>
              Get Started
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="grid-line" style={{
          minHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '4rem 2rem',
          position: 'relative',
        }}>
          {/* Glowing ring behind demo */}
          <div style={{
            position: 'absolute', width: '420px', height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
            border: '1px solid rgba(249,115,22,0.15)',
            pointerEvents: 'none',
          }} />

          <p className="fade-up fade-up-1" style={{
            fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.2em',
            color: '#f97316', textTransform: 'uppercase', marginBottom: '1.5rem',
          }}>
            AI-Powered Speed Reading
          </p>

          <h1 className="fade-up fade-up-2" style={{
            fontSize: 'clamp(2.8rem, 7vw, 6rem)',
            fontWeight: 900, lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
            background: 'linear-gradient(160deg, #ffffff 30%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Read at the<br />speed of thought.
          </h1>

          <p className="fade-up fade-up-3" style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: '#9ca3af', maxWidth: '560px',
            lineHeight: 1.7, marginBottom: '2.5rem',
          }}>
            Readapt transforms any PDF into a high-speed RSVP reading experience
            with Optimal Recognition Point highlighting — so your brain locks onto
            every word without moving your eyes.
          </p>

          {/* Live RSVP demo */}
          <div className="fade-up fade-up-3" style={{
            background: 'rgba(26,26,26,0.9)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: '20px',
            padding: '1.5rem 3rem',
            marginBottom: '2.5rem',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 60px rgba(249,115,22,0.08)',
          }}>
            <p style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.5rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Live preview — 500 WPM
            </p>
            <RSVPDemo />
          </div>

          <div className="fade-up fade-up-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/register" style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff', fontWeight: 700, padding: '0.85rem 2.2rem',
              borderRadius: '12px', fontSize: '1rem', textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(249,115,22,0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(249,115,22,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(249,115,22,0.35)' }}>
              Start Reading Free →
            </Link>
            <a href="#features" style={{
              background: 'transparent', color: '#e5e5e5', fontWeight: 600,
              padding: '0.85rem 2.2rem', borderRadius: '12px', fontSize: '1rem',
              textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)',
              transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}>
              See Features
            </a>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(26,26,26,0.6)',
          padding: '2rem',
          display: 'flex', justifyContent: 'center', gap: 'clamp(2rem, 6vw, 6rem)',
          flexWrap: 'wrap',
        }}>
          {[
            { val: '3×', label: 'Faster than average reading' },
            { val: '100–1000', label: 'WPM range' },
            { val: 'ORP', label: 'Optimal Recognition Point' },
            { val: '∞', label: 'PDFs you can upload' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: '#f97316' }}>{s.val}</p>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── FEATURES ── */}
        <section id="features" style={{ padding: 'clamp(4rem, 8vw, 8rem) 2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <SectionHeading>Everything you need to read faster</SectionHeading>
            <p style={{ color: '#6b7280', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Six core capabilities, engineered to work together seamlessly.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {features.map((f) => (
              <TiltCard key={f.title} className="">
                <div style={{
                  background: 'rgba(26,26,26,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px',
                  padding: '2rem',
                  height: '100%',
                  transition: 'border-color 0.3s',
                  animationDelay: `${0.08}s`,
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                  <div style={{
                    fontSize: '2.2rem', marginBottom: '1rem',
                    filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.4))',
                  }}>{f.icon}</div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.6rem', color: '#f1f5f9' }}>{f.title}</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.7 }}>{f.desc}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{
          padding: 'clamp(4rem, 8vw, 8rem) 2rem',
          background: 'rgba(15,15,15,0.8)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <SectionHeading>How it works</SectionHeading>
            <p style={{ color: '#6b7280', marginBottom: '4rem', lineHeight: 1.7 }}>
              Three steps from PDF to peak reading speed.
            </p>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { n: '01', title: 'Upload your PDF', desc: 'Drag and drop any document. We extract and clean every word automatically.' },
                { n: '02', title: 'Set your speed', desc: 'Choose your WPM — start at 300, push to 600, go beyond. The slider is yours.' },
                { n: '03', title: 'Read and resume', desc: 'Your progress is saved every 5 seconds. Pick up exactly where you left off, any time.' },
              ].map((step) => (
                <TiltCard key={step.n}>
                  <div style={{
                    background: 'rgba(26,26,26,0.9)',
                    border: '1px solid rgba(249,115,22,0.15)',
                    borderRadius: '20px',
                    padding: '2.5rem 2rem',
                    width: '260px',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: '-10px', right: '-10px',
                      fontSize: '5rem', fontWeight: 900, color: 'rgba(249,115,22,0.06)',
                      lineHeight: 1, userSelect: 'none',
                    }}>{step.n}</div>
                    <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f97316', marginBottom: '0.75rem' }}>{step.n}</p>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#f1f5f9' }}>{step.title}</h3>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.7 }}>{step.desc}</p>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section id="about" style={{ padding: 'clamp(4rem, 8vw, 8rem) 2rem', maxWidth: '900px', margin: '0 auto' }}>
          <SectionHeading>About Readapt</SectionHeading>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {[
              {
                label: 'The Motive',
                icon: '💡',
                text: `The average person reads at 200–250 WPM — far below the brain's processing capacity. 
                       Readapt was built to close that gap. By eliminating eye movement and anchoring attention 
                       on the ORP, readers can comfortably reach 400–600 WPM without losing comprehension.`,
              },
              {
                label: 'The Aim',
                icon: '🎯',
                text: `Make high-speed reading accessible to everyone — students, researchers, professionals, 
                       and curious minds. No expensive hardware, no complex setup. Just upload a PDF and read.`,
              },
              {
                label: 'Who Built This',
                icon: '🛠️',
                text: `Readapt is an open-source MVP built with React, TypeScript, Node.js, Express, and MongoDB. 
                       It's designed to be a foundation — fast, modular, and ready to grow with AI-powered 
                       comprehension features, vocabulary tracking, and adaptive speed training.`,
              },
            ].map(card => (
              <TiltCard key={card.label}>
                <div style={{
                  background: 'rgba(26,26,26,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px',
                  padding: '2rem',
                  height: '100%',
                  transition: 'border-color 0.3s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{card.icon}</div>
                  <h3 style={{
                    fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.75rem',
                    color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>{card.label}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.8 }}>{card.text}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{
          padding: 'clamp(4rem, 8vw, 8rem) 2rem',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%)',
          borderTop: '1px solid rgba(249,115,22,0.1)',
        }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900, letterSpacing: '-0.03em',
            color: '#fff', marginBottom: '1rem',
          }}>
            Ready to read faster?
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '2.5rem', fontSize: '1.1rem' }}>
            Free to use. No credit card. Just upload and go.
          </p>
          <Link to="/register" style={{
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#fff', fontWeight: 700, padding: '1rem 2.8rem',
            borderRadius: '14px', fontSize: '1.1rem', textDecoration: 'none',
            boxShadow: '0 8px 40px rgba(249,115,22,0.4)',
            display: 'inline-block',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 50px rgba(249,115,22,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(249,115,22,0.4)' }}>
            Create your free account →
          </Link>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '1rem',
          color: '#4b5563', fontSize: '0.8rem',
        }}>
          <span style={{ fontWeight: 900, color: '#f97316', fontSize: '1rem' }}>Readapt</span>
          <span>Built with React · Node.js · MongoDB</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link to="/login" style={{ color: '#4b5563', textDecoration: 'none' }}>Sign in</Link>
            <Link to="/register" style={{ color: '#4b5563', textDecoration: 'none' }}>Register</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
