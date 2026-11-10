/** Print the currently displayed chart and selected diagrams, without editing controls. */
export const printChart = async (content: HTMLElement, title: string, artist: string): Promise<void> => {
  if (content.querySelector('[aria-label="Preparando formação do acorde"]')) throw new Error('Aguarde os desenhos dos acordes terminarem de carregar antes de imprimir.');
  const frame = document.createElement('iframe');
  frame.title = 'Impressão da cifra'; frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';
  document.body.append(frame);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => { if (timer) clearTimeout(timer); frame.remove(); };
  try {
    const doc = frame.contentDocument, target = frame.contentWindow;
    if (!doc || !target) throw new Error('Não foi possível abrir a impressão.');
    doc.open(); doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'); doc.close(); doc.title = title;
    const styles = doc.createElement('style');
    // Reuse layout and fonts so chords keep their positions above the lyrics.
    const css = [...document.querySelectorAll('style,link[rel="stylesheet"]')];
    css.forEach(node => doc.head.append(doc.importNode(node, true)));
    styles.textContent = '@page{size:A4;margin:14mm}html,body{background:white!important;color:#111!important}body{font-family:"Atkinson Hyperlegible Next",sans-serif}[data-no-print]{display:none!important}button{border:0;background:none;color:#111!important}svg{max-width:100%}figure,.break-inside-avoid{break-inside:avoid}[data-chart-shapes]{margin-top:24px}[data-chart-shapes]>div{display:flex;flex-wrap:wrap;gap:20px}*{animation:none!important;transition:none!important;box-shadow:none!important}.text-chord,.text-muted-foreground{color:#222!important}.now-playing-marker:before{display:none}';
    doc.head.append(styles);
    styles.textContent += '.chart-shape-card{grid-template-rows:200px 40px!important}';
    const heading = doc.createElement('h1'); heading.textContent = title; doc.body.append(heading);
    if (artist) { const byline = doc.createElement('p'); byline.textContent = artist; doc.body.append(byline); }
    const copy = doc.importNode(content, true);
    copy.querySelectorAll('.now-playing,.now-playing-marker').forEach(node => node.classList.remove('now-playing', 'now-playing-marker'));
    copy.querySelectorAll('[data-no-print]').forEach(node => node.remove());
    // SVGs contain explicit theme colors; adapt their paints for white paper.
    const originals = content.querySelectorAll('figure svg *'); const clones = copy.querySelectorAll('figure svg *');
    originals.forEach((node, index) => {
      const clone = clones[index]; if (!clone) return;
      for (const paint of ['fill', 'stroke'] as const) {
        const raw = node.getAttribute(paint); if (!raw || raw === 'none') continue;
        const resolved = getComputedStyle(node)[paint] || raw;
        const rgb = resolved.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
        clone.setAttribute(paint, raw.includes('--surface') ? '#fff' : raw.includes('--foreground') || (rgb?.length === 3 && rgb.every(n => n > 150)) ? '#222' : resolved);
      }
    });
    doc.body.append(copy);
    await Promise.all([...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => new Promise<void>(resolve => {
      if (link.sheet) { resolve(); return; }
      const timeout = setTimeout(resolve, 5000);
      const done = () => { clearTimeout(timeout); resolve(); };
      link.addEventListener('load', done, { once: true }); link.addEventListener('error', done, { once: true });
    })));
    await doc.fonts?.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    target.addEventListener('afterprint', cleanup, { once: true }); timer = setTimeout(cleanup, 300000);
    target.focus(); target.print();
  } catch (error) { cleanup(); throw error; }
};
