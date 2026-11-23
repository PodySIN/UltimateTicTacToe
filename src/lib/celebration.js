export function fireworks() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = ['#5ceddf', '#b597ff', '#ffbf82', '#fff'][i % 4];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
    document.body.append(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}
