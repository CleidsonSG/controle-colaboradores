# Plano — Controle de Colaboradores

## Visão geral

Construir um sistema web semelhante ao Controla Cargos. Como o projeto está vazio e o fluxo após a importação não foi observado, começar por uma vertical slice segura: estrutura de navegação e importação local de CSV, XLSX e XLSM, com seleção do tipo, leitura, mapeamento, validação e prévia. Essa etapa não persiste nem envia dados.

**Stack da primeira fatia:** Next.js App Router, React e TypeScript. Essa escolha vale para o protótipo local; backend, persistência e serviços externos continuam sem decisão.  
**Sucesso inicial:** uma pessoa consegue escolher o formato, carregar um arquivo, associar colunas aos campos e revisar dados e erros sem gravá-los.

## Escopo

- Módulos previstos: Dashboard, Funcionários, Orçamento, Importar Dados, Estatísticas de Cargo, Manutenção de Cargos, Configurações e Ajuda.
- Dados de funcionário: matrícula, nome, CPF, cargo, lotação, telefone/celular, ano e mês.
- Estatísticas: Cargo, Quantidade, Ano e Mês.
- Necessidades observadas para fases futuras: filtros mensais; histórico do funcionário; custos por lotação (salário-base, férias, encargos e 13º); cargos com salário, gratificações, benefícios e status; gestão de usuários.
- O fluxo após importar não é conhecido; a primeira versão termina na prévia.

**Fora da primeira entrega:** persistência, importação para cloud, integração externa, autenticação, cálculos de orçamento, histórico e dashboards funcionais. Planejar esses itens em fases posteriores, após decisões e autorização apropriadas.

## Princípios e escolhas provisórias

- Tratar arquivos localmente no navegador; não transmitir conteúdo a serviços externos.
- Não registrar CPF, remuneração ou conteúdo de arquivo em logs. Minimizar retenção em memória e permitir limpar a prévia.
- A stack web da primeira fatia foi escolhida; banco, backend e serviço cloud seguem sem escolha ou autorização.
- XLSM significa leitura dos dados da planilha, não execução de macros. Definir comportamento para planilhas múltiplas, fórmulas e formatos ambíguos antes de ampliar a importação.

## Fases e tarefas

| ID | Fase / tarefa | Responsável e skill sugeridos | Dependências | Entrada → saída → verificação |
|---|---|---|---|---|
| 0.1 | Definir stack da primeira fatia, modelo inicial de campos, limites e UX | `frontend-expert-specialist` / `app-builder`; envolver segurança para privacidade | Nenhuma | Next.js/React/TypeScript e limite de 25 MB definidos para o protótipo; campos obrigatórios permanecem provisórios e precisam de validação de negócio |
| 1.1 | Criar shell responsivo com navegação para os oito módulos; marcar telas futuras como não implementadas | `frontend-specialist` / `app-builder` | 0.1 | Módulos e navegação → shell funcional → todas as rotas/módulos aparecem, navegação funciona e estados futuros não simulam funcionalidades |
| 1.2 | Implementar seletor de tipo/formato e carregamento local CSV, XLSX e XLSM | `frontend-specialist` / skill de interface e leitura local | 0.1, 1.1 | Arquivo escolhido e formato declarado → dados tabulares lidos em memória → aceitar formatos suportados, rejeitar arquivo incompatível/corrompido com mensagem clara; nenhuma chamada de rede ou gravação |
| 1.3 | Mapear colunas para os campos de funcionário, validar e mostrar prévia | `frontend-specialist` / skill de formulários e validação | 1.2 | Dados lidos e campos-alvo → mapeamento, erros e prévia editáveis → validar campos obrigatórios, destacar linhas/campos inválidos e permitir limpar; verificar que não há persistência |
| 2.1 | Definir contrato de dados e regras de período para as telas operacionais | `product-owner` + `database-architect` / modelagem de domínio | 1.3 | Campos iniciais e dúvidas de negócio → modelo e regras aprováveis → resolver unicidade de matrícula, formatos de CPF, mês/ano e política de duplicatas |
| 2.2 | Construir Funcionários, filtros mensais e histórico | `frontend-specialist` + `backend-specialist` / interface e regras de negócio | 2.1 e decisão de persistência | Modelo e regras → consulta/lista e histórico → filtros por mês/ano e histórico coerentes com registros de teste; não inventar o fluxo pós-importação |
| 2.3 | Implementar Dashboard e Estatísticas de Cargo | `frontend-specialist` + `backend-specialist` / visualização e agregações | 2.1, 2.2 | Dados e definições de métricas → indicadores e agrupamentos Cargo/Quantidade/Ano/Mês → totais conferem com conjunto de teste e filtros mensais |
| 2.4 | Implementar Orçamento por lotação | `product-owner` + `backend-specialist` / regras de negócio | 2.1 e definição financeira | Regras e valores aprovados → detalhamento de salário-base, férias, encargos e 13º por lotação → fórmulas e totais revisados pelo responsável do negócio |
| 2.5 | Implementar Manutenção de Cargos | `frontend-specialist` + `backend-specialist` / CRUD e validação | 2.1; coordenar com 2.4 | Modelo de cargos → gestão de salário, gratificações, benefícios e status → criar/editar/validar cargos e refletir vínculos sem inconsistências |
| 3.1 | Definir autenticação, gestão de usuários, autorização e retenção | `security-auditor` + `backend-specialist` / segurança e controle de acesso | 2.1; antes de qualquer dado persistente compartilhado | Requisitos de acesso e dados sensíveis → modelo de usuários/permissões e política de retenção → papéis e acessos revisados; nenhuma conta ou política presumida |
| 3.2 | Decidir e, se autorizado, implementar persistência e integração cloud | `database-architect` + `backend-specialist` / dados e integração | 3.1 e autorização explícita para serviço/destino | Arquitetura aprovada e autorização → persistência/importação controlada → testes de acesso, integridade e falha; sem envio real até autorização e configuração aprovadas |
| 4.1 | Completar Configurações e Ajuda; revisar acessibilidade e fluxos | `frontend-specialist` / UX e acessibilidade | 1.1; conteúdo depende das decisões de produto | Requisitos confirmados → telas e orientações → navegação por teclado, estados vazios/erro e conteúdo aprovados |

**Ordem:** fase 0 → fase 1 (vertical slice independente, sem banco) → fase 2 conforme modelo e regras aprovados → fase 3 somente após decisões de segurança e autorização → fase 4. Tarefas da fase 2 podem ser priorizadas separadamente após 2.1; orçamento depende de regras financeiras explícitas.

## Critérios de aceite da primeira entrega

- Shell navegável apresenta os oito módulos sem sugerir que telas futuras já funcionam.
- Importador identifica/seleciona CSV, XLSX ou XLSM e lê o arquivo localmente; conteúdo XLSM é tratado sem executar macros.
- Pessoa usuária pode mapear colunas para matrícula, nome, CPF, cargo, lotação, telefone/celular, ano e mês.
- Prévia mostra linhas e validações de forma compreensível; arquivo inválido ou campos não mapeados produzem erros acionáveis.
- A pessoa pode descartar e limpar a prévia; não há banco, envio de rede, upload remoto nem persistência.
- Testes automatizados cobrem os três formatos, arquivo inválido, cabeçalhos ausentes, limites, mapeamento e validação; verificar manualmente a limpeza e ausência de chamadas externas.

## Riscos

- CPF e remuneração são dados sensíveis: exposição em logs, telemetria, exemplos de teste ou serviços externos.
- CSV pode variar em codificação, delimitador e cabeçalho; XLSX/XLSM podem conter várias abas ou células com tipos ambíguos.
- Regras de duplicidade, obrigatoriedade, competência mensal, cálculos financeiros e pós-importação ainda não foram observadas.
- Persistência/cloud e gestão de usuários aumentam o impacto de privacidade, segurança e autorização; são bloqueadas até decisões explícitas.

## Decisões pendentes

1. Stack, navegadores suportados, limites de tamanho e experiência em dispositivos móveis.
2. Campos obrigatórios, unicidade de matrícula, validação/formatação de CPF e telefone, duplicatas e tratamento de campos vazios.
3. Codificações/delimitadores CSV; aba padrão ou seleção de aba; fórmulas e datas em planilhas; política para XLSM.
4. O que deve ocorrer após a prévia e quais filtros, regras e cálculos mensais são oficiais.
5. Se haverá persistência, serviço cloud, autenticação, perfis, retenção e exportação — definir serviço e obter autorização antes de qualquer envio de dados.

## Fase X — Verificação antes de considerar a entrega concluída

- [x] Executar lint, checagem de tipos e testes automatizados (8 testes aprovados).
- [x] Executar build de produção e smoke test das rotas inicial e Dashboard no navegador.
- [x] Testar CSV/XLSX/XLSM, validação, cabeçalho ausente, mapeamentos e limites com dados sintéticos.
- [x] Validar manualmente na interface importação, erros, ocultação de CPF e limpeza da prévia com arquivo sintético.
- [ ] Revisar acessibilidade detalhada; confirmar ausência de persistência/rede no código.
- [ ] Revisar dependências e tratamento local de dados; confirmar que CPF e remuneração não aparecem em logs.
- [x] Registrar somente resultados realmente verificados; não marcar itens como concluídos antecipadamente.
