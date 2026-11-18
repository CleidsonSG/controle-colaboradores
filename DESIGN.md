---
name: Controle de Colaboradores
description: Sistema institucional de gestão de pessoas para o setor público, sóbrio, legível e sem enfeites.
colors:
  primary: "#0b5c74"
  primary-foreground: "#ffffff"
  background: "#f4f6f8"
  foreground: "#15202b"
  card: "#ffffff"
  secondary: "#e4eef1"
  secondary-foreground: "#0b4a5d"
  muted: "#edf1f4"
  muted-foreground: "#556373"
  border: "#d9e0e7"
  input: "#b9c4cf"
  success: "#1c7547"
  warning: "#965800"
  destructive: "#b42318"
  sidebar: "#0e2a33"
  sidebar-foreground: "#d3e2e7"
  sidebar-muted: "#93afb8"
  sidebar-accent: "#17414e"
  sidebar-border: "#1d4552"
  sidebar-ring: "#6cc8db"
typography:
  title-page:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  indicator-figure:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "tabular-nums"
  indicator-strip:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
    fontFeature: "tabular-nums"
  title-card:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 12px"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
  tab-trigger:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    height: "44px"
---

# Design System: Controle de Colaboradores

## Overview

**Creative North Star: "Repartição Bem Cuidada"**

Uma repartição pública bem cuidada: sóbria, confiável, em ordem. O sistema trata gente e folha de pagamento, então a interface fala baixo e deixa o dado falar alto. Papel frio ao fundo, azul-petróleo como única voz de marca, um menu lateral escuro de ardósia que ancora a navegação. Nenhum enfeite: nada de gradientes, ilustrações ou decoração que não carregue informação.

A densidade é média e regular. Números grandes em algarismos tabulares, rótulos pequenos em cinza, linhas finas separando regiões. Os componentes são discretos e precisos: bordas de 1px, sombra mínima, raio suave de 10px. A informação aparece e a moldura some. O tema escuro é um espelho funcional do claro (mesmos papéis, valores reajustados), escolhido pelo usuário ou herdado do sistema.

**Key Characteristics:**
- Institucional de setor público; ordem e clareza acima de personalidade.
- Uma única cor de marca (azul-petróleo) e semânticas reservadas a estado.
- Bordas finas e sombra mínima; superfícies planas em camadas tonais.
- Public Sans, fonte desenhada para serviços públicos, com algarismos tabulares nos dados.
- Estado sempre dito em texto (e ícone), nunca só em cor.
- Claro e escuro com paridade total de tokens.

## Colors

Paleta fria e contida: um azul-petróleo, neutros acinzentados de matiz azulado e três semânticas de estado. Valores do tema claro no frontmatter; o tema escuro está descrito abaixo e no sidecar.

### Primary
- **Azul-Petróleo Institucional** (#0b5c74): ação principal, links, foco (`ring`), barras de progresso, aba ativa. Claro: #0b5c74; escuro: #55b7cf (com texto #062530 sobre ele).

### Secondary
- **Névoa Petróleo** (#e4eef1): fundo de botão secundário, selos neutros e hover de itens suaves; texto em **Petróleo Profundo** (#0b4a5d). Escuro: #1a2c35 com texto #b9dbe4.

### Neutral
- **Papel Frio** (#f4f6f8): fundo da página. Escuro: #0d151b.
- **Branco Cartão** (#ffffff): superfície de cartões, campos e popovers. Escuro: #131e26.
- **Tinta Azulada** (#15202b): texto principal. Escuro: #e3eaef.
- **Cinza Névoa** (#edf1f4): fundos suaves, trilho da barra de progresso, hover de linha de tabela. Escuro: #1a2630.
- **Cinza de Apoio** (#556373): texto secundário, rótulos, legendas. Escuro: #9bacb9.
- **Linha Fina** (#d9e0e7): bordas de cartão e divisórias. Escuro: #25333e.
- **Contorno de Campo** (#b9c4cf): borda de campos e botões de contorno. Escuro: #3a4a57.
- **Ardósia Noturna** (#0e2a33): menu lateral. Escuro: #091216. Complementos: **Texto de Ardósia** (#d3e2e7), **Apoio de Ardósia** (#93afb8), **Item Ativo de Ardósia** (#17414e), **Linha de Ardósia** (#1d4552) e **Brilho Turquesa** (#6cc8db), usado para foco, ícone ativo e barra indicadora no menu (igual nos dois temas).

### Estado
- **Verde Regular** (#1c7547): situação regular. Escuro: #4fc48c.
- **Âmbar Atenção** (#965800): atenção, fora da tabela. Escuro: #efb459.
- **Vermelho Folha** (#b42318): erro e valor negativo (saldo abaixo do teto). Escuro: #f2786b.

### Named Rules
**A Regra do Estado em Texto.** Cor nunca é o único portador de estado. Todo selo, valor negativo ou aviso traz palavra (e, quando cabe, ícone): "Fora da tabela", "Sem servidores". Cor reforça, o texto informa.

**A Regra do Selo de Lotação.** Cargo lotado é situação normal, não erro. A família de selos segue: `success` para folga confortável, `warning` para próximo do limite, `secondary` (neutro, barra azul) para cargo cheio, `destructive` somente para folha acima do teto. Vermelho é para excesso real, nunca para ocupação completa. (Implementada em `situacaoCargo` de `lib/folha/simulacao.ts`, usada pelo cartão de cargo da Folha: "Com vagas" `success` abaixo de 80%; "Quase lotado" `warning` de 80% a 99%; "Lotado" `secondary` com barra `primary` a partir de 100%; "Sem vagas" `warning` quando não há vaga cadastrada.)

**A Regra da Voz Única.** O azul-petróleo é a única cor de marca. Verde, âmbar e vermelho existem só para estado e nunca decoram.

## Typography

**Display Font:** Public Sans (com ui-sans-serif, system-ui, sans-serif)
**Body Font:** Public Sans (mesma família)
**Label/Mono Font:** não há; algarismos tabulares da própria Public Sans

**Character:** Public Sans foi criada para serviços públicos: neutra, aberta, muito legível em tamanhos pequenos. Hierarquia feita só por peso (400, 500, 600) e tamanho; um único conjunto estilístico (`ss01`) ligado no corpo.

### Hierarchy
- **Título de página** (600, 1.5rem/24px, 1.25): nome da tela no conteúdo.
- **Número de cartão** (600, 1.875rem/30px, tracking -0.025em, tabular): total de servidores no cartão de cargo.
- **Indicador da faixa** (600, 1.5rem/24px, tracking -0.025em, tabular): valores da faixa de indicadores; valores em reais cabem neste nível.
- **Título de cartão** (600, 1rem/16px, 1.375): nome do cargo ou da seção; no máximo 2 linhas (`line-clamp-2`).
- **Corpo** (400, 0.875rem/14px, 1.43): texto geral, células de tabela, legendas em Cinza de Apoio.
- **Rótulo** (500, 0.875rem/14px): botões, rótulos de campo, abas, itens de menu.
- **Legenda** (500, 0.75rem/12px): selos e notas curtas.

### Named Rules
**A Regra do Algarismo Tabular.** Todo número que se compara com outro (contagens, reais, percentuais) usa `tabular-nums`, para que colunas e faixas alinhem.

## Layout

Casca fixa: menu lateral de 16rem (256px) à esquerda no desktop, recolhível em gaveta no celular, com cabeçalho fino de 4rem (64px) e fundo translúcido com leve desfoque, fixo no topo. Conteúdo com largura máxima de 80rem (`max-w-7xl`), margens de 16px (celular), 24px (sm) e 32px (lg).

Ritmo de espaçamento em base de 4px: cartões com 20px de respiro interno (`p-5`) e 20px entre blocos internos, intervalos entre cartões de 16px a 24px. Grade responsiva: 1 coluna (celular), 2 (tablet), 3 a 4 (desktop). A faixa de indicadores é uma única grade com divisórias de 1px (dois por linha no celular, quatro no desktop), não quatro cartões soltos. Alvos de toque de no mínimo 40px (botões) e 44px (abas). Link "pular para o conteúdo" disponível ao foco do teclado.

## Elevation & Depth

Plano por padrão. A profundidade vem de camadas tonais (Papel Frio, Branco Cartão, Cinza Névoa) e de bordas de 1px, não de sombras. A única sombra do sistema é `shadow-xs` (sombra mínima) em cartões, campos e botões primários e de contorno; o item ativo do seletor de tema usa a mesma sombra. O cabeçalho usa translucidez com desfoque leve e a gaveta móvel, um véu de 40% de opacidade.

### Named Rules
**A Regra da Moldura que Some.** Se a informação se sustenta sem moldura, tire a moldura. Prefira divisória fina a cartão dentro de cartão; sombra nunca sobe além de `shadow-xs`.

## Shapes

Cantos suaves e consistentes, base de 10px (`--radius: 0.625rem`). Cartões e a faixa de indicadores usam 10px (lg); campos, botões e itens de menu, 8px (md); controles internos pequenos, 6px (sm); selos, trilhos de progresso e controles segmentados, pílula completa. Bordas de 1px na cor Linha Fina; campos e botões de contorno usam Contorno de Campo, um passo mais forte. Foco: contorno de 2px em `ring` com 2px de afastamento, em todo elemento focável.

## Components

Discretos e precisos: a moldura serve ao dado.

### Buttons
- **Shape:** cantos suaves (8px), altura 40px (padrão), 32px (pequeno), 44px (grande), 40px quadrado (ícone).
- **Primary:** Azul-Petróleo com texto branco, 14px peso 500, respiro horizontal de 16px, `shadow-xs`; hover a 90% de opacidade.
- **Outline / Secondary / Ghost / Destructive / Link:** contorno com fundo de cartão e borda de campo, hover em Névoa Petróleo; secundário em Névoa Petróleo; fantasma sem fundo; destrutivo em Vermelho Folha; link em azul-petróleo sublinhado ao hover.
- **Estados:** foco com contorno de 2px; desabilitado a 50% de opacidade sem eventos de ponteiro; ícones de 16px.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Branco Cartão com borda de 1px e `shadow-xs`.
- **Internal Padding:** 20px horizontal e vertical; título 16px/600, descrição 14px em Cinza de Apoio.
- **Cartão de cargo:** título (até 2 linhas) com selo opcional no canto, número grande tabular com legenda do que conta, grade de duas colunas (Salário, Custo mensal) com rótulo cinza e valor 500, barra de progresso de 8px de altura sobre trilho Cinza Névoa.

### Inputs / Fields
- **Style:** altura 40px, fundo de cartão, borda Contorno de Campo, raio 8px, texto 14px, placeholder em Cinza de Apoio.
- **Focus:** borda em `ring` e contorno de 2px a 40% de opacidade.
- **Error / Disabled:** erro em texto Vermelho Folha, com `role="status"`; desabilitado a 50% com cursor bloqueado. Rótulo sempre visível acima do campo (14px/500).

### Navigation
- **Menu lateral (Ardósia Noturna):** logotipo em quadrado de 36px com ícone em Brilho Turquesa a 15%; itens de 40px, raio 8px, texto Texto de Ardósia a 85%, ícone de 18px em Apoio de Ardósia. **Ativo:** fundo Item Ativo de Ardósia, texto branco peso 500, ícone em Brilho Turquesa e barra de 3px à esquerda; `aria-current="page"`. Hover a 60% do fundo ativo.
- **Cabeçalho:** 64px, fundo Papel Frio translúcido, borda inferior, trilha de caminho em 14px cinza e ações à direita (seletor de tema, sair).
- **Seletor de tema:** controle segmentado `radiogroup` (claro, escuro, sistema), trilho Cinza Névoa com borda; opção marcada em fundo de cartão com `shadow-xs`; rótulo de texto só a partir de lg.
- **Abas:** sublinhado de 2px (azul-petróleo na ativa, transparente nas demais), 14px/500, altura mínima 44px, sem fundo; lista com borda inferior e rolagem horizontal.

### Badges (Selos)
Pílula de 12px/500 com 10px de respiro lateral. Variantes de estado: fundo a 10% e borda a 30% da cor semântica com texto na cor cheia (`success`, `warning`, `destructive`); `secondary` em Névoa Petróleo; `default` em Azul-Petróleo cheio; `outline` só contorno. Ícone opcional de 12px.

### Tables
Células com 12px de respiro lateral e 10px vertical, cabeçalho de 44px em Cinza de Apoio peso 500, linhas separadas por borda fina, hover de linha em Cinza Névoa a 60%, sem zebra. No celular, listas substituem a tabela (gestão de usuários).

### Faixa de indicadores (componente de assinatura)
Uma grade com divisórias de 1px (`gap-px` sobre fundo de borda) dentro de um contêiner de 10px de raio: cada célula tem rótulo de 14px cinza, valor de 24px/600 tabular e nota opcional. Valor negativo fica em Vermelho Folha, e o texto acompanha. Uma lista com barras finas de 8px (rank numerado, valor à direita) serve às composições por lotação.

## Do's and Don'ts

### Do:
- **Do** usar apenas tokens (`bg-primary`, `text-muted-foreground`, `border-border`), nunca hexadecimais soltos nos componentes.
- **Do** dizer o estado em texto, com ícone de apoio quando couber (A Regra do Estado em Texto).
- **Do** usar `tabular-nums` em todo número comparável.
- **Do** manter bordas de 1px, raio de 10px nos cartões e 8px nos campos e botões, e sombra no máximo `shadow-xs`.
- **Do** manter o contorno de foco de 2px em `ring` visível em tudo que recebe foco, e honrar `prefers-reduced-motion`.
- **Do** manter paridade claro/escuro: todo papel de cor tem valor nos dois temas (escuro por `data-theme="dark"` ou preferência do sistema, salvo escolha explícita de claro).
- **Do** usar dados fictícios em capturas e protótipos: os dados de servidores são pessoais.

### Don't:
- **Don't** usar vermelho para cargo lotado; lotação cheia é normal (A Regra do Selo de Lotação).
- **Don't** usar cor como único indicador de estado.
- **Don't** introduzir uma segunda cor de marca nem usar verde, âmbar ou vermelho como decoração.
- **Don't** colocar cartão dentro de cartão nem moldura em volta do que a divisória fina já resolve.
- **Don't** usar sombras fortes, gradientes, ilustrações ou qualquer enfeite sem função informativa.
- **Don't** escrever CSS à mão nem criar classes próprias; o sistema é Tailwind + componentes de `components/ui/`.
