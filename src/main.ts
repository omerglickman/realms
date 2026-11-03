import { startApp } from './ui/app';

startApp().catch((err) => {
  console.error(err);
  const hud = document.getElementById('hud');
  if (hud) {
    const p = document.createElement('div');
    p.style.color = '#ff8080';
    p.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
    hud.appendChild(p);
  }
});
