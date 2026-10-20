# Bobinas — protótipo de rastreabilidade

Protótipo só de front-end (React + Vite, JavaScript), sem backend, para validar telas e fluxo da rastreabilidade de bobinas de aço. Especificação em `CLAUDE.md`; decisões em `DECISIONS.md`.

## Como rodar

Requisitos: Node 20 ou superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes de domínio (Vitest)
npm run build      # gera dist/ (site estático, funciona em subpasta)
npm run preview    # serve o dist/ para conferir
```

## Estrutura

```
src/domain/        regras puras (sem React), com testes ao lado
src/persistence/   repositório, anexos (IndexedDB), executor de comandos
src/ui/            app (rotas, layout, perfil), componentes, páginas
src/styles/        tokens de tema, base, impressão
scripts/           geração do seed a partir do Excel
```

## Estado atual

- Incremento 0 (fundação): shell no visual do SteelApps, seletor de perfil simulado com menu por permissão. As telas dos módulos são provisórias.
