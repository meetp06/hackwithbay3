import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [phoneVisible, setPhoneVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  // Mouse scrubbing video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleMouseMove = (e: MouseEvent) => {
      const prevX = prevXRef.current;
      const currentX = e.clientX;
      prevXRef.current = currentX;

      if (prevX === null || !video.duration) return;

      const delta = currentX - prevX;
      const sensitivity = 0.8;
      const timeOffset = (delta / window.innerWidth) * sensitivity * video.duration;

      targetTimeRef.current = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleSeeked = () => {
      const diff = Math.abs(video.currentTime - targetTimeRef.current);
      if (diff > 0.05) {
        video.currentTime = targetTimeRef.current;
      } else {
        isSeekingRef.current = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  // Initialize the Anchor Vanilla JS SPA inside the phone mockup once phoneVisible is true
  useEffect(() => {
    if (phoneVisible) {
      import('./main.js')
        .then(() => {
          console.log('[React Shell] Anchor Mobile SPA mounted successfully.');
        })
        .catch((err) => {
          console.error('[React Shell] Failed to load Anchor main.js:', err);
        });
    }
  }, [phoneVisible]);

  return (
    <div className="relative min-h-screen select-none font-body overflow-x-hidden bg-[#0a0e1a]">
      {/* Background Video */}
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4"
        className="fixed inset-0 w-full h-full object-cover object-[70%_center] z-0 pointer-events-none"
        muted
        playsInline
        preload="auto"
      />

      {/* Dark overlay to make text more readable over high-brightness video */}
      <div className="fixed inset-0 bg-black/30 z-0 pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 sm:px-12 py-6 sm:py-8">
        <div className="w-[120px] hidden md:block" /> {/* Left Spacer to center links */}
 
        {/* Desktop Links */}
        <div className="hidden md:flex items-center text-[23px] text-white/90">
          <a href="#labs" className="hover:opacity-60 transition-opacity">Labs</a>
          <span className="mx-1 select-none">, </span>
          <a href="#studio" className="hover:opacity-60 transition-opacity">Studio</a>
          <span className="mx-1 select-none">, </span>
          <a href="#openings" className="hover:opacity-60 transition-opacity">Openings</a>
          <span className="mx-1 select-none">, </span>
          <a href="#shop" className="hover:opacity-60 transition-opacity">Shop</a>
        </div>
 
        {/* Desktop CTA */}
        <div className="hidden md:block">
          <a href="mailto:hello@mainframe.co" className="text-[23px] text-white underline underline-offset-4 hover:opacity-60 transition-opacity">
            Get in touch
          </a>
        </div>
      </nav>
 
      {/* Main: phone + side product copy */}
      <main className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16 h-screen w-full px-8 sm:px-16 lg:px-24 max-w-[1700px] mx-auto">
 
        {/* LEFT Copy — motto */}
        <aside className="hidden lg:flex flex-col flex-1 max-w-[460px] text-white tracking-tight self-stretch justify-center pb-8" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
          <span className="text-[12px] uppercase tracking-[0.4em] text-indigo-400 font-semibold mb-6">
            Intelligent Focus
          </span>
          <h1 className="text-[76px] xl:text-[92px] leading-[0.9] font-extralight text-white mb-8 tracking-[-0.05em] uppercase">
            Focus is<br/>
            <span className="font-thin text-white/40">the new</span><br/>
            <span className="font-medium bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-indigo-300 bg-clip-text text-transparent">freedom.</span>
          </h1>
          <p className="text-[20px] xl:text-[23px] leading-[1.6] text-white/60 font-light max-w-[440px]">
            Every minute saved from scrolling is a minute reclaimed to build the future you actually want.
          </p>
        </aside>
 
        {/* PHONE */}
        <div
          id="app-phone-wrapper"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex justify-center items-center shrink-0"
          style={{ width: 'min(320px, calc(82vh * 320 / 696))' }}
        >
          {!phoneVisible ? (
            <div
              onClick={() => setPhoneVisible(true)}
              className="glass-card flex flex-col items-center justify-center p-6 text-center cursor-pointer border border-white/10 hover:border-white/30 transition-all w-full aspect-[320/696] rounded-[44px] bg-black/40 backdrop-blur-md shadow-2xl scale-95 hover:scale-100 duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-xl font-bold tracking-tight mb-4 shadow-lg shadow-indigo-500/30">M</div>
              <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">Mainframe</h3>
              <p className="text-white/60 text-xs mb-5 leading-relaxed font-light">
                Tap to launch the live Accountability Agent.
              </p>
              <button className="px-5 py-2.5 text-sm font-semibold rounded-full bg-white text-black hover:bg-white/90 transition-colors">
                Initialize
              </button>
              <p className="mt-5 text-white/40 text-[9px] tracking-[0.25em] uppercase font-medium">iPhone 17 Pro</p>
            </div>
          ) : (
            <div
              className="relative border-[10px] border-[#0b0f1a] rounded-[44px] overflow-hidden shadow-[0_0_60px_rgba(79,70,229,0.35)] w-full aspect-[320/696] bg-[#fdfbf7] flex flex-col animate-[screen-enter_0.5s_ease-out]"
            >
              {/* Phone Status Bar — opaque white, covers top so scroll content hides behind */}
              <div className="absolute top-0 left-0 right-0 h-11 z-40 px-5 flex justify-between items-center text-[11px] font-semibold text-black/80 select-none bg-white">
                <span>14:30</span>
                <div className="flex items-center gap-1">
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>
 
              {/* Dynamic Island — above status bar bg */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50" />
 
              {/* SPA Screen container (mounted by main.js) */}
              <div id="anchor-app" className="flex-1 overflow-y-auto bg-[#fdfbf7] min-h-0" style={{ paddingTop: '52px' }} />
            </div>
          )}
        </div>
 
        {/* RIGHT Copy — motto continued */}
        <aside className="hidden lg:flex flex-col flex-1 max-w-[460px] text-white tracking-tight self-stretch justify-center pb-8" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
          <span className="text-[12px] uppercase tracking-[0.4em] text-fuchsia-400 font-semibold mb-6 text-right">
            Skin in the Game
          </span>
          <h2 className="text-[76px] xl:text-[92px] leading-[0.9] font-extralight text-white mb-8 tracking-[-0.05em] text-right uppercase">
            Stake it<br/>
            <span className="font-thin text-white/40">on what</span><br/>
            <span className="font-medium bg-gradient-to-r from-fuchsia-400 via-indigo-500 to-fuchsia-300 bg-clip-text text-transparent">matters.</span>
          </h2>
          <p className="text-[20px] xl:text-[23px] leading-[1.6] text-white/60 font-light max-w-[440px] ml-auto text-right">
            Anchor negotiates your distraction. A live AI agent, your real goals, and stakes that back your success.
          </p>
        </aside>
      </main>

      {/* Brand Logo - relocated to bottom side */}
      <div className="fixed bottom-8 left-8 sm:left-12 z-50 flex items-center gap-2 select-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        <span className="text-[22px] sm:text-[26px] tracking-tight text-white/80 select-none font-extralight uppercase">
          Mainframe®
        </span>
        <span className="text-[24px] sm:text-[30px] text-white/40 select-none leading-none -ml-1">
          ✳︎
        </span>
      </div>
    </div>
  );
}
