'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Expand, Home, Info, Minus, Mouse, Orbit, Plus, Scan, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { BODIES, type BodyId } from '@/lib/planets';
import type { Observatory } from '@/lib/observatory';

export default function HomePage() {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<Observatory | null>(null);
  const [selected, setSelected] = useState<BodyId>('earth');
  const [view, setView] = useState('Explore');
  const [status, setStatus] = useState('Preparing the observatory');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [labels, setLabels] = useState(true);
  const [motion, setMotion] = useState(true);
  const body = BODIES.find(b => b.id === selected)!;

  useEffect(() => {
    let disposed = false;
    import('@/lib/observatory').then(({ createObservatory }) => {
      if (disposed || !mount.current) return;
      try {
        engine.current = createObservatory(mount.current, {
          onReady: () => { if (!disposed) setReady(true); },
          onProgress: setStatus,
          onSelect: id => { setSelected(id); setView('Explore'); },
          onError: message => { setStatus(message); setFailed(true); setReady(false); },
        });
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) { setMotion(false); engine.current.setMotion(false); }
      } catch { setFailed(true); setStatus('This experience needs WebGL 2. Please enable hardware acceleration or try another browser.'); }
    }).catch(() => { setFailed(true); setStatus('The observatory could not load. Please reload to try again.'); });
    return () => { disposed = true; engine.current?.dispose(); engine.current = null; };
  }, []);

  function visit(id: BodyId) { setSelected(id); setView('Explore'); engine.current?.focus(id); }
  function overview() { setView('Overview'); engine.current?.overview(); }

  return (
    <main className="observatory">
      <div ref={mount} className="scene" aria-label="Interactive 3D solar system size comparison. Drag to orbit, scroll to zoom, right-drag to move. Use the planet buttons to travel." />
      <div className="vignette" />
      <header className="masthead">
        <a className="brand" href="/" aria-label="Solar Scale home"><Orbit size={29} strokeWidth={1.1}/><span>SOLAR<span className="brand-light">SCALE</span><small>A MATTER OF PERSPECTIVE</small></span></a>
        <div className="header-actions"><span className="scale-badge"><span/>TRUE RELATIVE SCALE</span>
          <Dialog><DialogTrigger className="icon-button" aria-label="About this scale model"><Info size={19}/></DialogTrigger>
            <DialogContent className="about-dialog"><DialogHeader><span className="eyebrow">THE SCALE OF THINGS</span><DialogTitle>A shared ground. A true comparison.</DialogTitle><DialogDescription>All eight planets and the Sun use one consistent, linear scale. Nothing gets enlarged to make it easier to see.</DialogDescription></DialogHeader>
              <p>Dimensions use NASA’s equatorial and polar radii, so the gas giants are correctly flattened. Each body touches the ground at its lowest point. Saturn’s main rings extend to 136,775 km from its center.</p>
              <p>Positions are arranged for comparison. These are not orbital distances. The floor, soft shadows, lighting, solar color, star twinkle, and texture rotation are illustrative. Planet axes are upright for comparison, and the dock icons are navigation aids, not to scale.</p>
              <div className="about-controls"><label htmlFor="motion">Gentle rotation & star twinkle</label><Switch id="motion" checked={motion} onCheckedChange={v => { setMotion(v); engine.current?.setMotion(v); }}/></div>
              <p className="credits">Dimensions: <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA Planetary Fact Sheets <ArrowUpRight size={12}/></a> and <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html" target="_blank" rel="noreferrer">Sun Fact Sheet</a>.<br/>Textures: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope / INOVE</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Applied to 3D bodies with illustrative lighting.</p>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="planet-info" aria-live="polite" aria-atomic="true">
        <div className="eyebrow"><span className="info-dot" style={{ background: body.color }}/>{view === 'Overview' ? 'THE BIG PICTURE' : `${body.number} / ${body.kind}`}</div>
        <h1>{view === 'Overview' ? <>A little<br/>perspective.</> : body.name}</h1>
        <p className="planet-description">{view === 'Overview' ? 'One star. Eight planets. One true scale.' : body.description}</p>
        <div className="metrics" aria-label={view === 'Overview' ? `Reference: ${body.name}` : undefined}><div><span className="metric-label">{view === 'Overview' ? `${body.name.toUpperCase()} · DIAMETER` : 'EQUATORIAL DIAMETER'}</span><strong>{new Intl.NumberFormat('en-US').format(Math.round(body.equatorial * 2))}<small> km</small></strong></div><div><span className="metric-label">COMPARED TO EARTH</span><strong>{(body.equatorial / 6378.1).toFixed(body.id === 'sun' ? 1 : 2)}<small> ×</small></strong></div></div>
        <button className="text-button" onClick={overview} disabled={!ready}><Scan size={15}/> See the whole picture <ArrowUpRight size={14}/></button>
      </section>

      <div className="view-tools" aria-label="View controls">
        <button className="icon-button" title="Return to Earth (Home)" aria-label="Return to Earth" onClick={() => visit('earth')} disabled={!ready}><Home size={18}/></button>
        <button className="icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => engine.current?.zoom(0.7)} disabled={!ready}><Plus size={19}/></button>
        <button className="icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => engine.current?.zoom(1.4)} disabled={!ready}><Minus size={19}/></button>
        <div className="tool-divider"/>
        <button className="icon-button" title="Show or hide planet labels" aria-label="Planet labels" aria-pressed={labels} onClick={() => { setLabels(!labels); engine.current?.setLabels(!labels); }}><span className="label-icon">Aa</span></button>
        <button className="icon-button" title="Full screen" aria-label="Toggle full screen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void document.documentElement.requestFullscreen?.().catch(() => {}); }}><Expand size={17}/></button>
      </div>

      <footer className="bottom-interface">
        <div className="navigation-caption"><span><span className="live-dot"/>{view === 'Overview' ? 'SYSTEM OVERVIEW' : `YOU ARE NEAR ${body.name.toUpperCase()}`}</span><span className="mouse-hint"><Mouse size={14}/> Drag to orbit <i/> Scroll to explore <i/> Right-drag to pan</span></div>
        <nav className="planet-dock" aria-label="Travel to a planet">
          {BODIES.map(b => <button key={b.id} className={`planet-stop ${selected === b.id && view !== 'Overview' ? 'active' : ''}`} onClick={() => visit(b.id)} disabled={!ready} aria-pressed={selected === b.id && view !== 'Overview'}><span className={`planet-thumbnail ${b.id}`} style={{ backgroundImage: `url(/textures/${b.texture})` }}/><span>{b.name}</span><small>{b.id === 'earth' ? 'OUR REFERENCE' : `${(b.equatorial / 6378.1).toFixed(b.id === 'sun' ? 1 : 2)} × EARTH`}</small></button>)}
        </nav>
        <div className="bottom-note"><span><Sparkles size={12}/> Sizes to scale. Distances arranged for comparison.</span><span>01 STAR <i/> 08 PLANETS <i/> INFINITE PERSPECTIVE</span></div>
      </footer>
      {!ready && <div className={`loading-screen ${failed ? 'error' : ''}`} role="status"><Orbit size={36} className={failed ? '' : 'loading-orbit'}/><p>{status}</p>{failed && <button className="text-button" onClick={() => window.location.reload()}>Reload observatory</button>}</div>}
    </main>
  );
}
