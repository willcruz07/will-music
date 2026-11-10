let printing = false;

/** Engrave the current MusicXML on A4 pages; print only the score, never the app chrome. */
export const printScore = async (xml: string, title: string): Promise<void> => {
  if (printing) throw new Error('Já existe uma impressão em preparação ou aberta. Feche-a antes de tentar novamente.');
  printing = true;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;opacity:0;pointer-events:none';
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true'); frame.title = 'Impressão da partitura';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;pointer-events:none';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleaned = false;
  const cleanup = () => { if (cleaned) return; cleaned = true; if (timer) clearTimeout(timer); frame.remove(); printing = false; };
  let view: { clear: () => void } | undefined;
  try {
    document.body.append(host);
    const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
    const score = new OpenSheetMusicDisplay(host, { autoResize: false, backend: 'svg', pageFormat: 'A4_P', drawTitle: true, drawComposer: true, drawPartNames: true, disableCursor: true });
    view = score;
    await score.load(xml); score.render();
    const pages = host.querySelectorAll('svg');
    if (!pages.length) throw new Error('A partitura ainda não está pronta para imprimir.');
    document.body.append(frame);
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error('O navegador não conseguiu abrir a impressão.');
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:8mm}body{margin:0;background:white;color:black}.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}svg{display:block;width:100%;height:auto;max-width:100%}</style></head><body></body></html>');
    doc.close(); doc.title = title;
    for (const svg of pages) {
      const page = doc.createElement('div'); page.className = 'page';
      const copy = doc.importNode(svg, true);
      const width = Number.parseFloat(svg.getAttribute('width') ?? '');
      const height = Number.parseFloat(svg.getAttribute('height') ?? '');
      if (!copy.hasAttribute('viewBox') && width > 0 && height > 0) copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
      page.append(copy); doc.body.append(page);
    }
    await doc.fonts?.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    target.addEventListener('afterprint', cleanup, { once: true });
    timer = setTimeout(cleanup, 300000); // Safari may return before its dialog closes.
    target.focus(); target.print();
  } catch (error) { cleanup(); throw error; }
  finally { view?.clear(); host.remove(); }
};
