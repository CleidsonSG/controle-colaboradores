# Auditoria de acessibilidade (WCAG 2.2 AA) — 2026-11-12

Autor: `frontend-expert-specialist` (análise estática do código; sem teste em navegador/leitor de tela — não é declaração de conformidade).

## Achados

### Crítico
- **C1** Menu móvel fechado (`globals.css:261`, `app-shell.tsx:64`): sidebar só deslocada com `translateX(-105%)`; 9 links invisíveis recebem foco. Correção no `@media (max-width:680px)`: `.sidebar{visibility:hidden;transition:transform .22s ease-out,visibility 0s linear .22s}` e `.sidebar-open{visibility:visible;transition-delay:0s}`.
- **C2** Perda de foco (foco cai no `<body>`): (a) troca de aba faz `setSource(null)` (import-workspace.tsx:48) e desmonta/desabilita `#sheet-select` (212–227, 221) → não zerar `source` ao trocar aba (só `analysis`/`mapping`), não desabilitar o select, `aria-busy` só no bloco, restaurar foco via ref se `activeElement === body`; (b) "Analisar prévia" e selects de mapeamento com `disabled={busy}` (247, 259) → `aria-disabled={busy}` + retorno antecipado + estilo `[aria-disabled="true"]`; (c) "Limpar e começar novamente" é desmontado (328) → em `resetImport` focar `#load-type` ou `#file-input`.

### Alto
- **A1** Anel de foco âmbar `#f2a900` com 2,01:1 (`globals.css:38-41`, `156`) → `outline:3px solid var(--focus-ring)` (#17243b), âmbar opcional como halo `box-shadow:0 0 0 6px #f2a900`; `.file-select:focus-within` → `.file-select:has(:focus-visible)`.
- **A2** 26 pares de texto secundário abaixo de 4,5:1 (`.nav-caption`, `.brand-name>span`, `.sidebar-bottom`, `.topbar>p`, `.privacy-note p`, `.section-index`, `.workflow-meta`, `.workflow-step` inativo, `.field-label>span`, `.field-help`, `.drop-copy p`, `.file-types`, `.source-overview div>span`, `.subsection-heading>p`, `.action-row p`, `.result-banner p`, `.result-counts span`, `.empty-cell`, `.empty-result p`, `.panel-footer p`, `.page-footnote p`, `.prepared-copy`, token `--quiet`) → `var(--text-secondary)` (#5b6a80). `.required-tag` e `thead th` → `var(--text-secondary-strong)` (#566579). `.errors-intro`/`.more-errors` → `#724a46`.
- **A3** Borda de select `#d9e1eb` 1,32:1 (`globals.css:135`) → `var(--control-border)` #7a8aa0, hover `var(--control-border-hover)` #5b6a80; aplicar também a `.button-outline` (e opcional `.mobile-menu-button`).
- **A4** `aria-busy={busy}` na raiz (import-workspace.tsx:130) suprime anúncios → remover; se útil, só no bloco recalculado.
- **A5** Anúncios: `role="status"` criado junto com o texto (209); conclusão da leitura (216) não anunciada; `aria-live` na `<section>` 274–322 relê a tabela → uma única região `<p className="visually-hidden" role="status" aria-live="polite">` sempre montada, com textos: "Lendo arquivo neste navegador…", "Leitura concluída: {n} colunas, {m} registros.", "Analisando…", "Prévia pronta: {v} válidos, {i} com erros, {t} no total. Nenhum dado foi salvo." Remover `aria-live` da section; indicador visual sem `role`. **Nunca anunciar valores de células (CPF).**
- **A6** Sidebar fixa sem rolagem (`globals.css:45-55`) → `.sidebar{overflow-y:auto;overscroll-behavior:contain}`.

### Médio
- **M1** Obrigatoriedade/erros de mapeamento não programáticos (165–177, 236–256): `required` + `aria-required="true"` em `#load-type` e selects de campos obrigatórios; após análise com problema, calcular no componente `missing`/`duplicate` e aplicar `aria-invalid="true"` + `aria-describedby="map-{key}-error"` com `<p class="field-error">` visível; focar `.configuration-alert` (`tabIndex={-1}`) ou o primeiro select inválido; borda `var(--red)` #a93535.
- **M2** Etapas (158–162): `<ol aria-label="Etapas da importação">` com `<li>`, `aria-current="step"` e texto oculto "(concluída)/(etapa atual)/(pendente)"; zerar list-style/margin/padding.
- **M3** Título igual em todas as rotas (`layout.tsx:6-9`) → `title:{default:"Importar dados · Controle Colaboradores",template:"%s · Controle Colaboradores"}` + `generateMetadata` em `app/[section]/page.tsx` retornando `{title: sections[section]}`.
- **M4** Topbar sticky pode cobrir o foco → `html{scroll-padding-top:72px}`.
- **M5** Menu móvel aberto (app-shell.tsx:52-64): focar primeiro link ao abrir (`useEffect` + `matchMedia("(max-width:680px)")`); `inert` em `.page-column` só no mobile com menu aberto; ao clicar num link, fechar e focar `#main-content`; mover `id="primary-navigation"` para o elemento alternado.
- **M6** Tabela sem `<caption>` (301) → `<caption className="visually-hidden">Registros válidos — primeiras {n} linhas{; dados sensíveis ocultos}</caption>`.
- **M7** `.file-types` com `position:absolute` (`globals.css:157`, `287`) → fluxo normal no `.drop-zone`.
- **M8** Títulos (157, 230, 277, 292, 312): remover h2 oculto redundante; `aria-labelledby` para o h2 visível (`id="workflow-title"`); `.mapping-section` como `<section>`; "Prévia pronta" → `<h3 id="results-heading">`; "Registros válidos/para corrigir" → `<h4>` (ajustar CSS sem mudança visual).

### Baixo
- **B1** Alvos `.text-button` (mobile) e `.sensitive-toggle` → `min-height:24px`, `align-items:center`.
- **B2** Fontes 7–10px fixas → piso 12px (opcional).
- **B3** Textos em CAIXA ALTA no fonte → caixa normal + `text-transform:uppercase`.
- **B4** `<span class="visually-hidden" aria-hidden="true">` (338) inútil → remover.
- **B5** Contagens → `<dl>/<dt>/<dd>` (opcional).
- **B6** `usePathname()` com `trailingSlash` (app-shell.tsx:72) → `const current = pathname.replace(/\/+$/, "") || "/"`.
- **B7** `<aside>` contendo a navegação → `<div className="sidebar">` (opcional).
- **B8** `.main-content:focus{outline:none}` (foco programático do skip link).
- **B9** (bug funcional) toggle de dados sensíveis aparece sem colunas sensíveis mapeadas (293): `mapping[field.key] !== ""` → `Boolean(mapping[field.key])`.

## Critérios de aceite
1. lint, typecheck, 8/8 testes (ou mais) e build (com e sem `BASE_PATH=/controle-colaboradores`) verdes.
2. 375px, menu fechado: Tab1 skip link, Tab2 botão do menu, Tab3 primeiro controle do `<main>`; nenhum link oculto focável.
3. Menu aberto: foco no primeiro link; conteúdo atrás não tabulável; Esc fecha e devolve foco; clicar em link fecha e foca `#main-content`.
4. Trocar aba por setas mantém foco no `#sheet-select`; "Analisar prévia" via teclado mantém foco; "Limpar" foca `#load-type`/input; nunca `activeElement === body`.
5. Texto ≥ 4,5:1; bordas de select e anel de foco ≥ 3:1.
6. Uma única região `role="status"` sempre montada; sem `aria-live` na section; sem `aria-busy` na raiz; nenhum valor de célula anunciado.
7. Nome sem coluna após análise: `aria-required`, `aria-invalid`, `aria-describedby` com mensagem visível; alerta mantém `role="alert"`.
8. Etapas em `<ol>` com `aria-current="step"`; tabela com `<caption>`; títulos h1→h2→h3→h4 sem saltos.
9. `document.title` distinto em `/`, `/dashboard/`, `/help/`.
10. 320px e zoom 200% em 1280×720: sem rolagem horizontal fora da tabela; sem sobreposição na área de soltar; sidebar rolável até "Ajuda".
11. `prefers-reduced-motion: reduce`: nada anima; menu móvel funciona.
12. `aria-current="page"` correto em `/dashboard/` com `trailingSlash`.
13. Diff restrito aos arquivos permitidos; sem novas dependências; mudanças visuais só em cinzas, bordas, anel de foco e erro por campo.
