// Tema claro/escuro: escolha guardada no navegador; sem escolha, segue o sistema operacional.
const KEY = 'bobinas:v1:theme'

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage indisponível */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* storage indisponível */ }
  applyTheme(theme)
}
