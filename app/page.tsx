'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Expand, Home, Info, Minus, Mouse, Orbit, Plus, Scan, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SPEED_REFERENCES, speedComparison } from '@/lib/speed-references';
import { DEFAULT_SPEED, formatDistance, formatSpeed, type NavigationMode, type Telemetry } from '@/lib/navigation';
import { BODIES, AU_KM, type BodyId, type LayoutMode } from '@/lib/planets';
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
  const [layout, setLayout] = useState<LayoutMode>('compact');
  const [navigation, setNavigation] = useState<NavigationMode>('look');
  const [solarTimeScale, setSolarTimeScale] = useState<1 | 120>(120);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [telemetry, setTelemetry] = useState<Telemetry>({ gridKm: 127562, movingKms: 0, traveledKm: 0, referenceKm: 0 });
  const comparison = speedComparison(speed);
  const body = BODIES.find(b => b.id === selected)!;

  useEffect(() => {
    let disposed = false;
    import('@/lib/observatory').then(({ createObservatory }) => {
      if (disposed || !mount.current) return;
      try {
        engine.current = createObservatory(mount.current, {
          onReady: () => { if (!disposed) setReady(true); },
          onProgress: setStatus,
          onSpeed: setSpeed,
          onNavigation: setNavigation,
          onTelemetry: setTelemetry,
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
  function changeLayout(value: LayoutMode) { setLayout(value); setView('Explore'); engine.current?.setLayout(value); }
  function changeSpeed(value: number) { engine.current?.setSpeed(value); }
  function overview() { setView('Overview'); engine.current?.overview(); }

  return (
    <main className="observatory">
      <div ref={mount} className="scene" aria-label="Interactive 3D solar system size comparison. WASD moves, Q/E changes altitude, drag to look, brackets change speed. Use the planet buttons to travel." />
      <div className="vignette" />
      <header className="masthead">
        <a className="brand" href="/" aria-label="Solar Scale home"><Orbit size={29} strokeWidth={1.1}/><span>SOLAR<span className="brand-light">SCALE</span><small>A MATTER OF PERSPECTIVE</small></span></a>
        <div className="header-actions"><span className="scale-badge"><span/>TRUE RELATIVE SCALE</span>
          <Dialog><DialogTrigger className="icon-button" aria-label="About this scale model"><Info size={19}/></DialogTrigger>
            <DialogContent className="about-dialog"><DialogHeader><span className="eyebrow">THE SCALE OF THINGS</span><DialogTitle>A shared ground. A true comparison.</DialogTitle><DialogDescription>All eight planets and the Sun use one consistent, linear scale. Nothing gets enlarged to make it easier to see.</DialogDescription></DialogHeader>
              <p>Dimensions use NASA’s equatorial and polar radii, so the gas giants are correctly flattened. Each body touches the ground at its lowest point. Saturn’s main rings extend to 136,775 km from its center.</p>
              <p>Close together places the bodies in an exhibition. True distances aligns them on one straight line at their average center-to-center distance from the Sun. These are mean orbital radii, not current orbital positions or fixed distances between orbiting planets. The floor, soft shadows, lighting, solar color, star twinkle, and texture rotation are illustrative. Planet axes are upright for comparison, and the dock icons are navigation aids, not to scale.</p>
              <p>Solar plasma loops rise 18,000–60,500 km above the surface. Modeled loop lifetimes are 64–120 minutes. Real time advances one simulated second per second; Illustrative runs 120 times faster. These are procedural life cycles, not a magnetic-field simulation; the animated surface detail and colors are illustrative, not live solar imagery. <a href="https://eclipse2017.nasa.gov/coronal-mass-ejections" target="_blank" rel="noreferrer">NASA: solar loop scales ↗</a></p><div className="about-controls"><label htmlFor="motion">Animate surfaces, plasma & stars</label><Switch id="motion" checked={motion} onCheckedChange={v => { setMotion(v); engine.current?.setMotion(v); }}/></div>
              <p className="credits">Dimensions: <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA Planetary Fact Sheets <ArrowUpRight size={12}/></a> and <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html" target="_blank" rel="noreferrer">Sun Fact Sheet</a>.<br/>Textures: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope / INOVE</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Applied to 3D bodies with illustrative lighting.</p>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="layout-controls">
        <ToggleGroup aria-label="Planet spacing" value={[layout]} onValueChange={values => { if (values[0]) changeLayout(values[0] as LayoutMode); }} className="segmented" disabled={!ready}>
          <ToggleGroupItem value="compact">Close together</ToggleGroupItem>
          <ToggleGroupItem value="distances">True distances</ToggleGroupItem>
        </ToggleGroup>
        <p>{layout === 'compact' ? 'A shared floor. Unchanged planet sizes.' : 'Mean distances from the Sun · straight-line alignment'}</p>
      </div>

      <section className="planet-info" aria-live="polite" aria-atomic="true">
        <div className="eyebrow"><span className="info-dot" style={{ background: body.color }}/>{view === 'Overview' ? 'THE BIG PICTURE' : `${body.number} / ${body.kind}`}</div>
        <h1>{view === 'Overview' ? <>A little<br/>perspective.</> : body.name}</h1>
        <p className="planet-description">{view === 'Overview' ? 'One star. Eight planets. One true scale.' : body.description}</p>
        <div className="metrics" aria-label={view === 'Overview' ? `Reference: ${body.name}` : undefined}><div><span className="metric-label">{view === 'Overview' ? `${body.name.toUpperCase()} · DIAMETER` : 'EQUATORIAL DIAMETER'}</span><strong>{new Intl.NumberFormat('en-US').format(Math.round(body.equatorial * 2))}<small> km</small></strong></div><div><span className="metric-label">COMPARED TO EARTH</span><strong>{(body.equatorial / 6378.1).toFixed(body.id === 'sun' ? 1 : 2)}<small> ×</small></strong></div></div>
        {layout === 'distances' && <p className="solar-distance"><span className="metric-label">MEAN DISTANCE FROM SUN</span>{formatDistance(body.orbitKm)} <small>({(body.orbitKm / AU_KM).toFixed(2)} AU)</small></p>}
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

      <section className="travel-panel" aria-label="Movement controls">
        <div className="travel-panel-top"><span className="eyebrow">TRAVEL SPEED</span><span className={telemetry.movingKms > 0.01 ? 'moving-status moving' : 'moving-status'}>{telemetry.movingKms > 0.01 ? 'MOVING' : 'STOPPED'}</span></div>
        <div className="speed-readout"><strong>{formatSpeed(speed)}</strong><div className="speed-buttons"><button aria-label="Halve movement speed" onClick={() => changeSpeed(speed / 2)} disabled={!ready}><Minus size={15}/></button><button aria-label="Double movement speed" onClick={() => changeSpeed(speed * 2)} disabled={!ready}><Plus size={15}/></button></div></div>
        <div className="speed-comparison"><strong>{comparison.text}</strong><span>{(comparison.reference.kms * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} m/s · {comparison.reference.detail}</span><a href={comparison.reference.source} target="_blank" rel="noreferrer">Reference ↗</a></div>
        <Slider aria-label="Movement speed" min={-3} max={8} step={0.05} value={[Math.log10(speed)]} onValueChange={value => changeSpeed(10 ** (Array.isArray(value) ? value[0] : value))} disabled={!ready}/>
        <div className="speed-presets"><button onClick={() => changeSpeed(2000)}>Planetary</button><button onClick={() => changeSpeed(299792.458)}>Light speed</button><button onClick={() => changeSpeed(10000000)}>Interplanetary</button></div>
        <details className="speed-library"><summary>Try a real-world speed</summary><div>{SPEED_REFERENCES.map(ref => <div key={ref.name}><button disabled={!ready} onClick={() => changeSpeed(ref.kms)}><strong>{ref.name}</strong><span>{formatSpeed(ref.kms)}</span></button><small>{ref.detail} · <a href={ref.source} target="_blank" rel="noreferrer">source ↗</a></small></div>)}</div></details>
        <div className="solar-time-control"><span className="eyebrow">SOLAR ANIMATION</span><ToggleGroup aria-label="Solar animation speed" value={[String(solarTimeScale)]} onValueChange={values => { if (values[0]) { const rate = Number(values[0]) as 1 | 120; setSolarTimeScale(rate); engine.current?.setSolarTimeScale(rate); } }} className="segmented"><ToggleGroupItem value="120">Illustrative · 120×</ToggleGroupItem><ToggleGroupItem value="1">Real time · 1×</ToggleGroupItem></ToggleGroup><small>{solarTimeScale === 1 ? 'One simulated second per second. Changes are gradual.' : 'One modeled hour in 30 seconds.'} Modeled loop lives: 64–120 min.</small></div>
        <ToggleGroup aria-label="Mouse navigation" value={[navigation]} onValueChange={values => { if (values[0]) engine.current?.setNavigation(values[0] as NavigationMode); }} className="segmented look-modes">
          <ToggleGroupItem value="look">Mouse look</ToggleGroupItem><ToggleGroupItem value="orbit">Orbit</ToggleGroupItem>
        </ToggleGroup>
        <div className="odometer"><span>WASD distance</span><output>{formatDistance(telemetry.traveledKm)}</output></div>
        <div className="odometer"><span>To {body.name}’s center</span><output>{formatDistance(telemetry.referenceKm)}</output></div>
        <div className="odometer"><span>Major grid spacing</span><output>{formatDistance(telemetry.gridKm)}</output></div>
        <p className="travel-keys"><kbd>W A S D</kbd> move · <kbd>Q E</kbd> down / up<br/><kbd>[ ]</kbd> speed · drag to {navigation === 'look' ? 'look' : 'orbit'}</p>
        <div className="touch-movement" aria-label="Touch movement">
          {([{code:'KeyW',label:'Forward',symbol:'↑'},{code:'KeyA',label:'Left',symbol:'←'},{code:'KeyS',label:'Back',symbol:'↓'},{code:'KeyD',label:'Right',symbol:'→'}]).map(key => <button key={key.code} aria-label={`Move ${key.label.toLowerCase()}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setMovementKey(key.code,true); }} onPointerUp={() => engine.current?.setMovementKey(key.code,false)} onPointerCancel={() => engine.current?.setMovementKey(key.code,false)} onLostPointerCapture={() => engine.current?.setMovementKey(key.code,false)}>{key.symbol}</button>)}
        </div>
      </section>

      <footer className="bottom-interface">
        <div className="navigation-caption"><span><span className="live-dot"/>{view === 'Overview' ? 'SYSTEM OVERVIEW' : `REFERENCE: ${body.name.toUpperCase()}`}</span><span className="mouse-hint"><Mouse size={14}/> WASD to move <i/> Drag to {navigation === 'look' ? 'look' : 'orbit'} <i/> [ ] to change speed</span></div>
        <nav className="planet-dock" aria-label="Travel to a planet">
          {BODIES.map(b => <button key={b.id} className={`planet-stop ${selected === b.id && view !== 'Overview' ? 'active' : ''}`} onClick={() => visit(b.id)} disabled={!ready} aria-pressed={selected === b.id && view !== 'Overview'}><span className={`planet-thumbnail ${b.id}`} style={{ backgroundImage: `url(/textures/${b.texture})` }}/><span>{b.name}</span><small>{layout === 'distances' ? `${(b.orbitKm / AU_KM).toFixed(2)} AU FROM SUN` : b.id === 'earth' ? 'OUR REFERENCE' : `${(b.equatorial / 6378.1).toFixed(b.id === 'sun' ? 1 : 2)} × EARTH`}</small></button>)}
        </nav>
        <div className="bottom-note"><span><Sparkles size={12}/> {layout === 'compact' ? 'Sizes to scale. Distances arranged for comparison.' : 'Sizes and mean solar distances use the same linear scale. Markers identify distant bodies.'}</span><span>01 STAR <i/> 08 PLANETS <i/> INFINITE PERSPECTIVE</span></div>
      </footer>
      {!ready && <div className={`loading-screen ${failed ? 'error' : ''}`} role="status"><Orbit size={36} className={failed ? '' : 'loading-orbit'}/><p>{status}</p>{failed && <button className="text-button" onClick={() => window.location.reload()}>Reload observatory</button>}</div>}
    </main>
  );
}
