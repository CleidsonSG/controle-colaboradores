# E-mails do Supabase em português

Os textos dos e-mails ficam no painel do Supabase, não no código.
Caminho: **Authentication > Emails > Templates**. Em cada modelo abaixo, troque o **Subject** e o **Body** (aba Source) e clique em **Save changes**.
Não altere `{{ .ConfirmationURL }}`: é o link gerado pelo Supabase.

## Reset Password (nova senha)

**Subject:**

```
Controle Colaboradores: crie uma nova senha
```

**Body:**

```html
<h2>Criar nova senha</h2>
<p>Olá,</p>
<p>Recebemos um pedido para criar uma nova senha de acesso ao <strong>Controle Colaboradores</strong> para o e-mail {{ .Email }}.</p>
<p><a href="{{ .ConfirmationURL }}">Criar nova senha</a></p>
<p>O link vale por tempo limitado e só pode ser usado uma vez.</p>
<p>Se você não fez esse pedido, ignore este e-mail: sua senha atual continua valendo.</p>
```

## Confirm signup (confirmação de cadastro)

**Subject:**

```
Controle Colaboradores: confirme seu e-mail
```

**Body:**

```html
<h2>Confirme seu e-mail</h2>
<p>Olá,</p>
<p>Recebemos um pedido de acesso ao <strong>Controle Colaboradores</strong> com o e-mail {{ .Email }}.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>
<p>Depois da confirmação, um administrador precisa aprovar o seu acesso. Se você foi convidado, o acesso é liberado assim que confirmar.</p>
<p>Se você não fez esse pedido, ignore este e-mail.</p>
```

## Change Email Address (troca de e-mail)

**Subject:**

```
Controle Colaboradores: confirme o novo e-mail
```

**Body:**

```html
<h2>Confirme a troca de e-mail</h2>
<p>Olá,</p>
<p>Recebemos um pedido para trocar o e-mail de acesso ao <strong>Controle Colaboradores</strong> de {{ .Email }} para {{ .NewEmail }}.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar o novo e-mail</a></p>
<p>Se você não fez esse pedido, ignore este e-mail.</p>
```

## Observações

- Os modelos **Magic Link**, **Invite user** e **Reauthentication** não são usados pelo sistema; podem ficar como estão.
- O remetente padrão do Supabase (`noreply@mail.app.supabase.io`) tem limite baixo de envios por hora. Para um remetente próprio, é preciso configurar SMTP em **Authentication > Emails > SMTP Settings** (serviço externo: exige autorização).
