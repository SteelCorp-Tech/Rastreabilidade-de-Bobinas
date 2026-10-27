// Código injetado em cada página: ajudantes para operar a interface e desenhar as setas numeradas dos prints.
(() => {
  const NS = 'http://www.w3.org/2000/svg'
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const RED = '#e5322d'

  function find(spec) {
    if (typeof spec === 'string') spec = { text: spec }
    const css = spec.css || 'button, a, th, label, h1, h2, h3, span, td, p, input, select, li, summary, div'
    let els = [...document.querySelectorAll(css)].filter(visible)
    if (spec.text) {
      const t = norm(spec.text)
      els = els.filter((e) => norm(e.innerText || e.value || e.placeholder || '').includes(t))
      els = els.filter((e) => !els.some((o) => o !== e && e.contains(o))) // só os mais internos
    }
    return els[spec.nth || 0] || null
  }
  function need(spec) {
    const el = find(spec)
    if (!el) throw new Error('Elemento não encontrado: ' + JSON.stringify(spec))
    return el
  }

  function setValue(el, value) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  function setSelect(el, value) {
    const opt = [...el.options].find((o) => o.value === value || norm(o.textContent).startsWith(norm(value)))
    if (!opt) throw new Error('Opção não encontrada: ' + value)
    setValue(el, opt.value)
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t))

  /** Retângulos que têm texto ou são controles: as etiquetas evitam cair em cima deles. */
  function occupied() {
    const out = []
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,label,td,th,button,a,input,select,textarea,img,svg,li,b,small,dt,dd,div')) {
      if (el.closest('#__ann')) continue
      const tag = el.tagName.toLowerCase()
      const ctl = ['input', 'select', 'textarea', 'img', 'svg', 'button'].includes(tag)
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!ctl && !hasText) continue
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue
      if (r.width * r.height > innerWidth * innerHeight * 0.4) continue
      out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom })
    }
    return out
  }

  const api = {
    wait,
    find,
    scroll(spec, block = 'center') { need(spec).scrollIntoView({ block }); return true },
    click(spec) { need(spec).click(); return true },
    fillLabel(text, value, nth = 0) {
      const labels = [...document.querySelectorAll('label')].filter((l) => norm(l.textContent).includes(norm(text)))
      const label = labels[nth]
      if (!label) throw new Error('Rótulo não encontrado: ' + text)
      const el = label.querySelector('input,select,textarea')
      if (el.tagName === 'SELECT') setSelect(el, value); else setValue(el, value)
      return true
    },
    fillCss(css, value, nth = 0) {
      const el = [...document.querySelectorAll(css)][nth]
      if (!el) throw new Error('Campo não encontrado: ' + css)
      if (el.tagName === 'SELECT') setSelect(el, value); else setValue(el, value)
      return true
    },
    attach(labelText, name, content, type = 'application/pdf') {
      const label = [...document.querySelectorAll('label')].find((l) => norm(l.textContent).includes(norm(labelText)))
      if (!label) throw new Error('Campo de arquivo não encontrado: ' + labelText)
      const el = label.querySelector('input[type=file]')
      const dt = new DataTransfer()
      dt.items.add(new File([content], name, { type }))
      el.files = dt.files
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    key(css, key) {
      const el = document.querySelector(css)
      if (!el) throw new Error('Campo não encontrado: ' + css)
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      return true
    },
    clear() { document.getElementById('__ann')?.remove() },

    /**
     * items: [{ target, text, side, pad }]. Desenha o contorno do alvo, uma etiqueta numerada e a seta.
     * A etiqueta vai para o espaço livre mais próximo (sem cobrir texto, controles, outros alvos ou outras etiquetas).
     */
    annotate(items) {
      api.clear()
      const W = innerWidth, H = innerHeight
      const occ = occupied()
      const root = document.createElement('div')
      root.id = '__ann'
      root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Montserrat,system-ui,sans-serif'
      const svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('width', W); svg.setAttribute('height', H)
      svg.style.cssText = 'position:absolute;inset:0'
      svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${RED}"/></marker></defs>`
      root.appendChild(svg)
      document.body.appendChild(root)

      const found = items.map((it) => {
        const el = find(it.target)
        if (!el) return null
        const r = el.getBoundingClientRect()
        const pad = it.pad ?? 4
        return { it, box: { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad } }
      })
      const missing = items.filter((_, i) => !found[i]).map((it) => JSON.stringify(it.target))
      const boxes = found.filter(Boolean).map((f) => f.box)
      const placed = []

      found.forEach((f, i) => {
        if (!f) return
        const { it, box } = f
        const rect = document.createElementNS(NS, 'rect')
        rect.setAttribute('x', box.l); rect.setAttribute('y', box.t); rect.setAttribute('width', box.r - box.l); rect.setAttribute('height', box.b - box.t)
        rect.setAttribute('rx', 6); rect.setAttribute('fill', 'rgba(229,50,45,.08)'); rect.setAttribute('stroke', RED); rect.setAttribute('stroke-width', 3.5)
        svg.appendChild(rect)

        const lab = document.createElement('div')
        lab.style.cssText = `position:absolute;left:0;top:0;max-width:${it.maxWidth ?? 300}px;background:${RED};color:#fff;font-weight:700;font-size:17px;line-height:1.25;padding:8px 13px 8px 9px;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,.32);display:flex;gap:9px;align-items:flex-start`
        lab.innerHTML = `<span style="background:#fff;color:${RED};border-radius:50%;min-width:27px;height:27px;display:inline-grid;place-items:center;font-size:16px;font-weight:800;flex:none">${it.n ?? i + 1}</span><span>${it.text}</span>`
        root.appendChild(lab)
        const lw = lab.offsetWidth, lh = lab.offsetHeight
        const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2
        const hw = (box.r - box.l) / 2, hh = (box.b - box.t) / 2

        let best = null
        for (let a = 0; a < 24; a++) {
          const th = (a / 24) * Math.PI * 2
          const dx = Math.cos(th), dy = Math.sin(th)
          for (const r of [30, 60, 95, 140, 195, 265, 350]) {
            const x = clamp(cx + dx * (hw + lw / 2 + r) - lw / 2, 8, W - lw - 8)
            const y = clamp(cy + dy * (hh + lh / 2 + r) - lh / 2, 8, H - lh - 8)
            const lr = { l: x, t: y, r: x + lw, b: y + lh }
            let cost = 0
            for (const o of occ) cost += area(lr, o)
            for (const p of placed) cost += area(lr, p) * 40
            for (const b of boxes) cost += area(lr, b) * 12
            const dist = Math.hypot((lr.l + lr.r) / 2 - cx, (lr.t + lr.b) / 2 - cy)
            cost += dist * 14
            const side = it.side
            const pref = (side === 'top' && dy < -0.5) || (side === 'bottom' && dy > 0.5) || (side === 'left' && dx < -0.5) || (side === 'right' && dx > 0.5)
            if (pref) cost -= 1200
            if (!best || cost < best.cost) best = { cost, x, y, lr }
          }
        }
        lab.style.left = best.x + 'px'; lab.style.top = best.y + 'px'
        placed.push(best.lr)

        // seta: do ponto da etiqueta mais próximo do alvo até o ponto do alvo mais próximo da etiqueta
        const lcx = (best.lr.l + best.lr.r) / 2, lcy = (best.lr.t + best.lr.b) / 2
        const tx = clamp(lcx, box.l, box.r), ty = clamp(lcy, box.t, box.b)
        const sx = clamp(tx, best.lr.l, best.lr.r), sy = clamp(ty, best.lr.t, best.lr.b)
        const line = document.createElementNS(NS, 'path')
        const mx = (sx + tx) / 2, my = (sy + ty) / 2
        const bend = Math.hypot(tx - sx, ty - sy) > 110 ? 16 : 0
        const nx = -(ty - sy), ny = tx - sx, nl = Math.hypot(nx, ny) || 1
        line.setAttribute('d', `M${sx},${sy} Q${mx + (nx / nl) * bend},${my + (ny / nl) * bend} ${tx},${ty}`)
        line.setAttribute('fill', 'none'); line.setAttribute('stroke', RED); line.setAttribute('stroke-width', 4.5); line.setAttribute('marker-end', 'url(#ah)')
        svg.appendChild(line)
      })
      return missing
    },
  }
  window.__m = api
  window.confirm = () => true
})()
