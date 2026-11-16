---
name: controle-visual
description: Especificidades visuais do Controle_Colaboradores (telas-chave e restrições). Complementa a skill frontend-design do workspace, que é a autoridade visual e contém as regras gerais (Tailwind + shadcn/ui, tokens, hierarquia, estados, claro/escuro, loop visual).
---

# Controle Colaboradores — especificidades visuais

As regras visuais vêm da skill **`frontend-design` do workspace** (`../.agent/skills/frontend-design/SKILL.md`), aplicada pelo agente líder `frontend-design`. Tokens, cores e tipografia deste projeto: [docs/GUIA-VISUAL.md](../../../docs/GUIA-VISUAL.md).

## Restrições do projeto

- Site estático no GitHub Pages (`output: 'export'`); componentes interativos com `"use client"`.
- Persistência: Supabase com login e aprovação (ou IndexedDB sem as variáveis). Nenhum outro serviço externo sem autorização.
- Dados de servidores são pessoais e sensíveis: capturas, protótipos e testes só com dados fictícios. Ver `docs/acessibilidade-auditoria.md` para o estado de acessibilidade.

## Telas-chave

- **Painel de cargos:** faixa de indicadores no topo (servidores ativos, cargos ocupados, custo da folha, saldo do teto) e cards por cargo com servidores, salário, custo e vagas livres.
- **Cards por função:** nome da função, total de pessoas, vagas ocupadas/livres, barra de ocupação e selo de situação.
- **Importação:** três cartões (e-Cidade, Planilha, Tabela salarial), área de soltar arquivos, resumo e erros legíveis.
- **Configurações > Gestão de usuários:** tabela no desktop, lista no celular.
