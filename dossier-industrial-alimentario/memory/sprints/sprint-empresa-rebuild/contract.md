# Sprint Contract: empresa-rebuild

- Agent: generator
- Delivers: `/empresas/[slug]` como vista brutalmente atractiva (compacta, sin redundancias)
- Success Criteria:
  - [ ] page.tsx importa y renderiza los 9 componentes del spec sin secciones extra
  - [ ] empresa.css mantiene paleta dark luxury + bento editorial
  - [ ] Cada componente < 800 líneas
  - [ ] No emojis, no Tailwind defaults
  - [ ] Hero destaca: nombre display 96px, status badges semánticas
  - [ ] Bento de 5 KPIs con jerarquía (facturación/EBITDA span 2 cols)
  - [ ] Build pasa, deploy reinicia servicio, URL responde 200
  - [ ] Smoke script verifica 5 asserts
- Context Budget: 100k tokens
- Dependencies: schema v6, seed v6 con 7+ companies
