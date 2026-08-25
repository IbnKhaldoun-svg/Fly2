(() => {
  if (!/Fly2Android\//i.test(navigator.userAgent) || window.__fly2AndroidRouteLayoutFix) return;
  window.__fly2AndroidRouteLayoutFix = true;

  const style = document.createElement('style');
  style.id = 'fly2-android-route-layout-fix';
  style.textContent = `
    html.fly2-native-app .route-grid.fly2-has-multi-airports{
      position:relative!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr)!important;
      gap:6px!important;
      overflow:visible!important;
    }
    html.fly2-native-app .route-grid.fly2-has-multi-airports>.swap{
      position:absolute!important;
      left:50%!important;
      right:auto!important;
      top:var(--fly2-swap-top,50%)!important;
      transform:translate(-50%,-50%)!important;
      margin:0!important;
      width:36px!important;
      height:36px!important;
      min-width:36px!important;
      min-height:36px!important;
      z-index:40!important;
      box-shadow:0 5px 16px rgba(18,61,56,.16)!important;
    }
    html.fly2-native-app .route-grid.fly2-has-multi-airports>.location-field{
      position:relative!important;
      min-width:0!important;
    }
    html.fly2-native-app .fly2-multi-airport-row{
      min-height:0!important;
      margin:4px 4px 0!important;
      gap:5px!important;
    }
    html.fly2-native-app .fly2-multi-airport-row.is-empty{
      min-height:27px!important;
    }
    html.fly2-native-app .fly2-multi-airport-add{
      min-height:25px!important;
      padding:3px 8px!important;
      font-size:9.5px!important;
    }
    html.fly2-native-app .fly2-multi-airport-chip{
      min-height:25px!important;
      padding:3px 7px!important;
    }
  `;
  document.head.appendChild(style);

  function install() {
    const grid = document.querySelector('.route-grid');
    const originField = document.getElementById('origin')?.closest('.location-field');
    const destinationField = document.getElementById('destination')?.closest('.location-field');
    const swap = document.getElementById('swap');
    if (!grid || !originField || !destinationField || !swap) {
      window.setTimeout(install, 120);
      return;
    }

    grid.classList.add('fly2-has-multi-airports');

    const positionSwap = () => {
      const gridRect = grid.getBoundingClientRect();
      const originRect = originField.getBoundingClientRect();
      const destinationRect = destinationField.getBoundingClientRect();
      if (!gridRect.height || !originRect.height || !destinationRect.height) return;
      const between = originRect.bottom + Math.max(0, destinationRect.top - originRect.bottom) / 2;
      grid.style.setProperty('--fly2-swap-top', `${Math.round(between - gridRect.top)}px`);
    };

    positionSwap();
    requestAnimationFrame(positionSwap);
    window.setTimeout(positionSwap, 80);

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(positionSwap);
      observer.observe(grid);
      observer.observe(originField);
      observer.observe(destinationField);
    }
    window.addEventListener('resize', positionSwap, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
