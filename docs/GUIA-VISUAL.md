> Substituído por [DESIGN.md](../DESIGN.md) em 2026-11-18 (gerado por /impeccable document). Este arquivo fica como histórico.

# Guia visual — Controle de Colaboradores

Autoridade: agente e skill `frontend-design` do workspace; especificidades na skill local [`controle-visual`](../.claude/skills/controle-visual/SKILL.md). Este guia define os tokens e padrões; **a referência visual do usuário, quando informada, tem prioridade** e deve ser registrada na seção final.

## Por que a aparência anterior não agradava

| Causa | Situação anterior | Correção definida |
|---|---|---|
| CSS manual | 427 linhas em `globals.css`, sem Tailwind | Tailwind CSS v4 + tokens de tema; sem classes próprias |
| Sem biblioteca de componentes | Markup e estilo feitos à mão | shadcn/ui (Button, Card, Badge, Table, Tabs, Input, Dialog, Skeleton, Progress) |
| Sem sistema de design | Espaços, tipografia e sombras inconsistentes | Escala única de espaçamento, tipografia e raios (abaixo) |
| Prioridade em função e acessibilidade | Estética sem dono | `frontend-design` responsável pelo visual |
| Pouca iteração visual | Sem conferência de telas | Verificação visual obrigatória em 3 larguras e 2 temas |

## Tokens

Implementados em `app/globals.css` (2026-11-15). Direção: institucional de setor público — azul-petróleo como cor de marca, fundo cinza frio, menu lateral escuro. Ajustar conforme a referência do usuário.

| Papel | Claro | Escuro |
|---|---|---|
| `primary` (azul-petróleo) | `#0b5c74` | `#55b7cf` |
| `background` | `#f4f6f8` | `#0d151b` |
| `foreground` | `#15202b` | `#e3eaef` |
| `sidebar` | `#0e2a33` | `#091216` |
| `success` / `warning` / `destructive` | `#1c7547` / `#965800` / `#b42318` | `#4fc48c` / `#efb459` / `#f2786b` |

Tipografia: **Public Sans** (fonte criada para serviços públicos), empacotada via `@fontsource-variable/public-sans` + `next/font/local`.

| Token | Uso |
|---|---|
| `background` / `foreground` | Fundo da página e texto |
| `card` / `card-foreground` | Superfície dos cartões |
| `primary` | Ação principal, destaque de marca |
| `muted` / `muted-foreground` | Fundos suaves e texto secundário |
| `border` / `ring` | Linhas e foco |
| `success` | Vagas livres confortáveis, situação regular |
| `warning` | Lotação alta (próxima do limite) |
| `destructive` | Lotação completa ou excedida, erros |

- **Raios:** `rounded-lg` (cartões), `rounded-md` (campos e botões), `rounded-full` (selos).
- **Sombras:** `shadow-sm` em cartões; sem sombras fortes.
- **Espaçamento:** base de 4px; cartões com `p-5` ou `p-6`; intervalo entre cartões `gap-4`/`gap-6`; largura máxima do conteúdo `max-w-7xl`.
- **Indicadores:** uma faixa única com divisórias finas (não quatro cartões soltos); valores em reais um nível menor para caber.
- **Tipografia:** Public Sans (via `next/font/local`), escala: título de página `text-2xl font-semibold`, título de cartão `text-base font-medium`, indicador `text-3xl font-semibold tabular-nums`, apoio `text-sm text-muted-foreground`.

## Estrutura da aplicação

- **Menu lateral** fixo (recolhível no celular): Funcionários (planilha 1), Funcionários (planilha 2), Importar, Cadastros.
- **Cabeçalho** com título da tela, busca e alternância de tema.
- **Conteúdo** em grade responsiva: 1 coluna (celular), 2 (tablet), 3–4 (desktop).

## Cartão de função (especificação)

```
┌──────────────────────────────┐
│ Agente administrativo   [Selo]│  ← nome + selo (Regular / Atenção / Lotada)
│                              │
│ 18        ocupadas de 24     │  ← número grande (tabular-nums)
│ ████████████░░░░░░  75%      │  ← barra de progresso (Progress)
│ 6 vagas livres               │  ← texto de apoio
│ Servidores 11 · Terceirizados 7 │  ← detalhe secundário
└──────────────────────────────┘
```

- Selo: `success` até 80% de ocupação, `warning` de 80% a 99%, `secondary` (neutro, barra azul) a partir de 100%: cargo lotado é situação normal, não erro. `destructive` fica para folha acima do teto. O estado também aparece em **texto**, nunca só em cor.
- Sem vaga total cadastrada: exibir "Vagas não definidas" e ação "Definir vagas".
- Cartão inteiro é focável quando levar a detalhes, com foco visível.

## Indicadores do topo

Quatro cartões compactos: **Total de pessoas**, **Vagas ocupadas**, **Vagas livres**, **Taxa de ocupação**.

## Plano de migração (ordem) — itens 1 a 6 concluídos em 2026-11-15

1. Instalar dependências: `tailwindcss`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` e primitivos Radix exigidos pelos componentes shadcn.
2. Configurar `postcss.config.mjs`, `components.json`, `lib/utils.ts` (`cn`) e tokens em `app/globals.css`.
3. Fonte via `next/font`.
4. Gerar componentes em `components/ui/`.
5. Migrar na ordem: `app-shell` → `employees-view` e `data-table` → `import-workspace`.
6. Remover o CSS manual de `globals.css` à medida que cada tela é migrada.
7. Criar a tela de cards por função e o cadastro de vagas (IndexedDB).
8. Validar: lint, typecheck, testes, build, verificação visual e acessibilidade.

## Referência visual do usuário

_A preencher: site ou sistema considerado profissional, com capturas de tela._
