(() => {
  const core = document.createElement('script');
  core.src = './app-v3-core.js';
  core.onload = () => {
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
      .back-to-top.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
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
      @media (prefers-reduced-motion: reduce) {
        .back-to-top { transition: none; }
      }
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.setAttribute('aria-label', 'Torna all’inizio della pagina');
    button.innerHTML = '<span class="back-to-top-arrow" aria-hidden="true">↑</span><span class="back-to-top-label">Torna su</span>';
    document.body.appendChild(button);

    const updateVisibility = () => {
      button.classList.toggle('visible', window.scrollY > 520);
    };

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();
  };
  core.onerror = () => console.error('Impossibile caricare il motore dell’interfaccia Fly2.');
  document.head.appendChild(core);
})();