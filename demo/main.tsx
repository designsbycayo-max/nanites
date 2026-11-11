import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ParticleLogo } from '../src/particle-logo';
import '../src/particle-logo.css';
import './style.css';

const repository = 'https://github.com/designsbycayo-max/particle-logo';
const initial = { src: `${import.meta.env.BASE_URL}scatter.svg`, width: 1000, height: 190 };
function App() {
  const [artwork, setArtwork] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setArtwork(initial); return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    let active = true;
    image.onload = () => {
      if (!active) return;
      const ratio = image.naturalHeight / image.naturalWidth;
      if (!Number.isFinite(ratio) || ratio < 0.05 || ratio > 2) {
        setError('Choose an image between 1:2 and 20:1 in shape.');
        return;
      }
      setArtwork({ src: url, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => { if (active) setError('This image could not be opened. Try a PNG, SVG or WebP.'); };
    image.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);
  return <>
    <header><a href="#" className="identity">Particle logo<span>By Plainsight</span></a><a href={repository}>View source <span aria-hidden="true">↗</span></a></header>
    <main>
      <section className="intro"><p className="eyebrow">An open-source interaction</p><h1>A little disruption.<br />Then back together.</h1><p>Move your cursor across the artwork. Each patch scatters into particles, drifts, and finds its way back.</p></section>
      <section className="stage" aria-label="Interactive particle logo demo">
        <div className="stage-label"><span>01 / Move across the artwork</span><span>Canvas 2D · React</span></div>
        <ParticleLogo {...artwork} alt={file && artwork.src !== initial.src ? 'Your selected artwork' : 'Scatter'} disabled={disabled} />
        <div className="controls"><label className="file-button">Try your image<input type="file" accept="image/png,image/svg+xml,image/webp" onChange={event => {
          const next = event.target.files?.[0];
          event.target.value = '';
          if (!next) return;
          if (next.size > 5 * 1024 * 1024) { setError('Choose an image smaller than 5 MB.'); return; }
          setError(''); setArtwork(initial); setFile(next);
        }} /></label><button onClick={() => { setArtwork(initial); setFile(null); setError(''); }}>Reset image</button><label className="motion"><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} />Pause motion</label></div>
        <p className="hint">Your image stays in this browser. Transparent artwork works best. On touch screens or with reduced motion enabled, the image stays still.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <section className="notes"><div><p className="eyebrow">Use it in your project</p><h2>Your artwork.<br />The same interaction.</h2><p>Copy the component and stylesheet into a React project, then pass in your image. No animation library needed.</p><a href={`${repository}#usage`}>Read the setup guide <span aria-hidden="true">↗</span></a></div><pre><code>{`<ParticleLogo\n  src="/your-logo.svg"\n  alt="Your brand"\n  width={1000}\n  height={190}\n/>`}</code></pre></section>
    </main>
    <footer><span>Originally made for Plainsight.</span><a href={`${repository}/blob/main/LICENSE`}>Code licensed under MIT</a></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
