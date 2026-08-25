(() => {
  const core = document.createElement('script');
  core.src = './app-v3-core.js';
  core.onload = () => {
    const liveStyle = document.createElement('link');
    liveStyle.rel = 'stylesheet';
    liveStyle.href = './styles-live.css';
    document.head.appendChild(liveStyle);

    const polishStyle = document.createElement('link');
    polishStyle.rel = 'stylesheet';
    polishStyle.href = './styles-polish.css';
    document.head.appendChild(polishStyle);

    const detailStyle = document.createElement('link');
    detailStyle.rel = 'stylesheet';
    detailStyle.href = './styles-result-details.css';
    document.head.appendChild(detailStyle);

    const airlineModeStyle = document.createElement('link');
    airlineModeStyle.rel = 'stylesheet';
    airlineModeStyle.href = './styles-airline-mode.css';
    document.head.appendChild(airlineModeStyle);

    const ryanairCompareStyle = document.createElement('link');
    ryanairCompareStyle.rel = 'stylesheet';
    ryanairCompareStyle.href = './styles-ryanair-compare.css';
    document.head.appendChild(ryanairCompareStyle);

    const style = document.createElement('style');
    style.textContent = `
      .back-to-top {
        position: fixed;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(18px, calc(18px + env(safe-area-inset-bottom)));
        z-index: 35;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid rgba(13,102,95,.18);
        border-radius: 999px;
        background: rgba(255,255,255,.96);
        color: #084d48;
        box-shadow: 0 10px 28px rgba(17,49,44,.16);
        font: inherit;
        font-size: 12px;
        font-weight: 850;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: opacity .18s ease, transform .18s ease, visibility .18s ease, background .18s ease;
        backdrop-filter: blur(8px);
      }
      .back-to-top.visible { opacity: 1; visibility: visible; transform: translateY(0); }
      .back-to-top:hover { background: #e6f2ef; }
      .back-to-top .back-to-top-arrow { font-size: 17px; line-height: 1; }
      @media (max-width: 520px) {
        .back-to-top {
          right: 12px;
          bottom: max(12px, calc(12px + env(safe-area-inset-bottom)));
          width: 46px;
          height: 46px;
          min-height: 46px;
          padding: 0;
          justify-content: center;
        }
        .back-to-top-label { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { .back-to-top { transition: none; } }
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.setAttribute('aria-label', 'Torna all’inizio della pagina');
    button.innerHTML = '<span class="back-to-top-arrow" aria-hidden="true">↑</span><span class="back-to-top-label">Torna su</span>';
    document.body.appendChild(button);

    const updateVisibility = () => button.classList.toggle('visible', window.scrollY > 520);
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();

    const details = document.createElement('script');
    details.src = './app-result-details.js';
    details.onload = () => {
      const airlineMode = document.createElement('script');
      airlineMode.src = './app-airline-mode.js';
      airlineMode.onload = () => {
      const ryanairCompare = document.createElement('script');
      ryanairCompare.src = './app-ryanair-compare.js';
      ryanairCompare.onload = () => {
      const live = document.createElement('script');
      live.src = './app-live.js';
      live.onload = () => {
        if (/Fly2Android\//i.test(navigator.userAgent)) {
          const multiAirport = document.createElement('script');
          multiAirport.src = './app-android-multi-airport.js?v=20260825-2';
          multiAirport.onerror = () => console.error('Impossibile caricare la ricerca multi-aeroporto Android.');
          document.head.appendChild(multiAirport);
        }

        const polish = document.createElement('script');
        polish.src = './app-polish.js';
        polish.onload = () => {
          const calendarFix = document.createElement('script');
          calendarFix.src = './app-calendar-stable-fix.js';
          calendarFix.onerror = () => console.error('Impossibile caricare la correzione stabile del calendario di Fly2.');
          document.head.appendChild(calendarFix);

          const stopoverSummary = document.createElement('script');
          stopoverSummary.src = './app-stopover-summary.js';
          stopoverSummary.onerror = () => console.error('Impossibile caricare il riepilogo stabile degli scali di Fly2.');
          document.head.appendChild(stopoverSummary);

          const summaryDetails = document.createElement('script');
          summaryDetails.src = './app-summary-details-v2.js';
          summaryDetails.onerror = () => console.error('Impossibile caricare il riepilogo avanzato di Fly2.');
          document.head.appendChild(summaryDetails);
        };
        polish.onerror = () => console.error('Impossibile caricare i miglioramenti UI di Fly2.');
        document.head.appendChild(polish);
      };
      live.onerror = () => console.error('Impossibile caricare la ricerca voli live di Fly2.');
      document.head.appendChild(live);
      };
      ryanairCompare.onerror = () => console.error('Impossibile caricare il confronto prezzi Ryanair.');
      document.head.appendChild(ryanairCompare);
      };
      airlineMode.onerror = () => console.error('Impossibile caricare il filtro compagnie di Fly2.');
      document.head.appendChild(airlineMode);
    };
    details.onerror = () => console.error('Impossibile caricare i dettagli di destinazioni e compagnie.');
    document.head.appendChild(details);
  };
  core.onerror = () => console.error('Impossibile caricare il motore dell’interfaccia Fly2.');
  document.head.appendChild(core);
})();