---
name: frontend-design
description: Responsável único pelo visual deste projeto. Use em qualquer tarefa que crie ou altere telas, componentes, cores, tipografia, espaçamento ou layout. Padrão obrigatório - Tailwind CSS + shadcn/ui, sem CSS escrito à mão.
---

# Frontend Design — autoridade visual do projeto

Esta skill **assume todas as decisões visuais**. Agentes de frontend (`frontend-specialist` etc.) continuam responsáveis por funcionalidade, estado, testes e acessibilidade, mas **não decidem estética**: cores, tipografia, espaçamento, hierarquia, sombras e composição de telas seguem este documento e o [guia visual](../../../docs/GUIA-VISUAL.md).

## Regras obrigatórias

1. **Sem CSS escrito à mão.** Estilo só por classes utilitárias do Tailwind e componentes shadcn/ui. `app/globals.css` contém apenas: `@import "tailwindcss"`, tokens de tema (`@theme` / variáveis CSS) e camadas base. Proibido criar classes CSS próprias para componentes.
2. **Componentes antes de markup.** Botões, cards, selos, tabelas, abas, diálogos, campos e menus vêm de `components/ui/` (shadcn/ui). Padrões de variação com `class-variance-authority`; junção de classes com `cn()` em `lib/utils.ts`. Ícones: `lucide-react`.
3. **Tokens, não valores soltos.** Nenhuma cor hexadecimal ou espaçamento arbitrário (`w-[13px]`) em componentes. Use os tokens do guia visual. Cores semânticas (`primary`, `muted`, `success`, `warning`, `destructive`) para claro e escuro.
4. **Tipografia profissional.** Fonte via `next/font` (auto-hospedada, compatível com export estático). Escala definida no guia; números de indicadores com `tabular-nums`.
5. **Hierarquia clara.** Uma ação primária por tela; indicadores no topo; conteúdo em cards com respiro generoso; no máximo 2 níveis de ênfase por cartão.
6. **Estados completos.** Todo componente de dados trata: carregando (skeleton), vazio (mensagem + ação), erro e sucesso.
7. **Claro e escuro** sempre juntos. Testar os dois temas.

## Restrições do projeto (não negociáveis)

- Site estático (`output: 'export'`): sem server actions, route handlers, proxy ou `next/headers`. Componentes interativos usam `"use client"`.
- Processamento local: sem backend, autenticação ou serviços externos. Fontes e ícones devem ser empacotados (nada de CDN em tempo de execução).
- Acessibilidade WCAG 2.2 AA preservada: contraste mínimo 4,5:1 (texto) e 3:1 (componentes), foco visível, alvo de toque mínimo 24px, nunca só cor para transmitir estado (usar texto/ícone junto), respeito a `prefers-reduced-motion`. Ver `docs/acessibilidade-auditoria.md`.
- Dados pessoais são sensíveis: dados de exemplo em protótipos e testes são sempre fictícios.

## Processo de trabalho

1. Ler `docs/GUIA-VISUAL.md` e, se houver, a referência visual que o usuário indicou.
2. Propor a composição da tela (blocos e hierarquia) antes de codificar.
3. Implementar com componentes shadcn/ui + Tailwind.
4. **Verificar visualmente**: abrir a prévia, conferir claro/escuro, larguras de celular (375px), tablet (768px) e desktop (1280px). Corrigir antes de entregar.
5. Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (com `BASE_PATH`). Tudo verde.
6. Mostrar prévia ao usuário; publicar só com autorização (ver `AGENTS.md`).

## Telas-chave

- **Cards por função:** nome da função, total de pessoas, vagas ocupadas / livres, barra de ocupação e selo de situação (ver especificação no guia visual).
- **Indicadores:** faixa de 4 cartões no topo (total de pessoas, vagas ocupadas, vagas livres, taxa de ocupação).
- **Importação:** área de soltar arquivos, resumo da importação e erros legíveis.

## O que evitar

- Layouts de "template" (cartões idênticos sem hierarquia, tudo centralizado, tudo com a mesma ênfase).
- Bordas pesadas, sombras fortes, gradientes decorativos sem função.
- Muitas cores de destaque: uma cor de marca, o resto neutro e semântico.
- Tabelas densas sem espaçamento nem cabeçalho fixo.
