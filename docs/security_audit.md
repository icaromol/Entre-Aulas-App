# Auditoria de Segurança — estudamus

| Campo | Valor |
|---|---|
| **Versão** | 1.0 |
| **Data** | 2026-06-08 |
| **Escopo** | Código-fonte completo da aplicação web (frontend React + Supabase) |
| **Metodologia** | Análise estática de código, OWASP Top 10 2021, STRIDE, OWASP ASVS 4.0 |
| **Auditores** | Claude Sonnet 4.6 (análise automatizada) |
| **Status** | Findings pendentes de remediação |

---

## Resumo Executivo

A auditoria identificou **17 findings** distribuídos em 4 níveis de severidade:

| Severidade | Quantidade | IDs |
|---|---|---|
| CRÍTICO | 2 | SEC-01, SEC-02 |
| ALTO | 5 | SEC-03, SEC-04, SEC-05, SEC-06, SEC-07 |
| MÉDIO | 7 | SEC-08 a SEC-14 |
| BAIXO | 3 | SEC-15, SEC-16, SEC-17 |

A principal superfície de risco concentra-se em **três vetores**: (1) o fluxo de convite de alunos, que permite enumeração de registros e hijacking de conta sem token de segurança; (2) a ausência de source maps desabilitados em produção, que expõe o código TypeScript original; e (3) a falta de headers HTTP de segurança no servidor de produção.

O modelo de segurança baseado em RLS (Row-Level Security) do Supabase está corretamente estruturado para as tabelas principais, o que limita o impacto de ataques que dependam de acesso direto ao banco. Entretanto, falhas no fluxo de autenticação e na configuração de infraestrutura elevam o risco operacional.

**Ações imediatas recomendadas:** SEC-02 (sourcemap: false), SEC-11 (invite sem sobrescrever), SEC-04 (AuthGuard com profile nulo).

---

## Superfície de Ataque

```
Usuário (Browser)
    │
    ├─► https://entre-aulas-app.vercel.app
    │       └─ Sem vercel.json → sem headers de segurança HTTP       [SEC-03]
    │
    ├─► dist/assets/*.js  (bundle Vite)
    │       ├─ VITE_SUPABASE_URL exposta                              [SEC-16]
    │       ├─ VITE_SUPABASE_ANON_KEY exposta                        [SEC-16]
    │       └─ Source maps .js.map gerados por padrão                [SEC-02]
    │
    ├─► /cadastro?invite=<studentId>  (sem token de segurança)
    │       ├─ Enumeração de alunos por UUID                         [SEC-01]
    │       └─ Hijacking de registro de aluno                        [SEC-01]
    │
    ├─► /login, /cadastro  (auth endpoints)
    │       ├─ Sem rate limiting / backoff                            [SEC-06]
    │       └─ Erros brutos do Supabase expostos                     [SEC-05]
    │
    └─► Supabase REST API
            ├─ JWT armazenado em localStorage                         [SEC-08]
            ├─ RLS policies bem estruturadas ✅
            └─ fn_my_teacher_id() / fn_my_student_id() ✅
```

---

## Findings

---

### [SEC-01] Invite Flow — Enumeração e Hijacking de Conta de Aluno

| | |
|---|---|
| **Severidade** | CRÍTICO |
| **Categoria** | OWASP A01: Broken Access Control / CWE-284 |
| **Arquivo** | `src/pages/auth/RegisterPage.tsx` linhas 26–38, 71–75 |

**Descrição**

O sistema de convite de alunos expõe o registro de alunos a dois vetores de ataque distintos.

**Vetor 1 — Enumeração de registros**

A página de cadastro aceita `?invite=<uuid>` na URL e consulta a tabela `students` sem qualquer validação adicional:

```typescript
// RegisterPage.tsx — linhas 26–38
supabase
  .from('students')
  .select('first_name, last_name, contact_email')
  .eq('id', inviteStudentId)   // ← qualquer UUID, sem token, sem expiração
  .single()
  .then(({ data }) => {
    if (data) setInviteStudent(data)  // ← nome e e-mail expostos publicamente
  })
```

Qualquer pessoa pode iterar sobre UUIDs e descobrir nomes e e-mails de alunos cadastrados, mesmo sem estar autenticada.

**Vetor 2 — Hijacking de conta**

Ao criar a conta, o `profile_id` do novo usuário é vinculado ao registro do aluno sem verificar se já existe um vínculo:

```typescript
// RegisterPage.tsx — linhas 71–75
await supabase
  .from('students')
  .update({ profile_id: data.user.id })
  .eq('id', inviteStudentId)   // ← sem .is('profile_id', null)
```

Se um atacante obtiver o UUID de um aluno (via enumeração ou vazamento) e criar uma conta antes do aluno legítimo, assume o perfil dele. Se o aluno legítimo já tiver conta, o cadastro do atacante sobrescreve o `profile_id`.

**Risco**

- Exposição de PII (nomes e e-mails) de todos os alunos da plataforma a usuários não autenticados
- Sequestro de conta de aluno antes ou após o vínculo legítimo

**Remediação**

1. Adicionar coluna `invite_token UUID DEFAULT gen_random_uuid()` e `invite_expires_at TIMESTAMPTZ` na tabela `students`
2. Gerar o token no backend ao cadastrar o aluno; incluir no link: `/cadastro?invite=<studentId>&token=<invite_token>`
3. Validar com `.eq('invite_token', token).is('profile_id', null).gt('invite_expires_at', 'now()')`
4. Zerar o token após uso bem-sucedido
5. Ajuste mínimo imediato: adicionar `.is('profile_id', null)` ao UPDATE (ver SEC-11)

---

### [SEC-02] Source Maps Habilitados em Produção

| | |
|---|---|
| **Severidade** | CRÍTICO |
| **Categoria** | CWE-540: Inclusion of Sensitive Information in Source Code |
| **Arquivo** | `vite.config.ts` |

**Descrição**

A configuração do Vite não define `build.sourcemap`, o que faz o bundler gerar arquivos `.js.map` por padrão no diretório `dist/`:

```typescript
// vite.config.ts — configuração atual
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // ❌ ausente: build: { sourcemap: false }
})
```

Com os source maps acessíveis publicamente, qualquer pessoa pode recuperar o código TypeScript original da aplicação, incluindo lógica de autenticação, fluxos de autorização, nomes de tabelas e queries.

**Risco**

Combinado com a `anon key` exposta no bundle (SEC-16), os source maps reduzem significativamente o esforço necessário para explorar outras vulnerabilidades.

**Remediação**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    sourcemap: false,   // ← adicionar esta linha
  },
})
```

---

### [SEC-03] Headers de Segurança HTTP Ausentes

| | |
|---|---|
| **Severidade** | ALTO |
| **Categoria** | OWASP A05: Security Misconfiguration |
| **Arquivo** | N/A — `vercel.json` inexistente |

**Descrição**

A aplicação não configura nenhum header de segurança HTTP. Não existe `vercel.json` no repositório.

| Header | Status | Risco |
|---|---|---|
| `Content-Security-Policy` | Ausente | XSS por injeção de scripts externos |
| `X-Frame-Options` | Ausente | Clickjacking |
| `Strict-Transport-Security` | Ausente | Downgrade HTTPS → HTTP |
| `X-Content-Type-Options` | Ausente | MIME-type sniffing |
| `Referrer-Policy` | Ausente | Vazamento de URLs internas via Referer |
| `Permissions-Policy` | Ausente | Acesso a câmera/microfone por scripts injetados |

**Remediação**

Criar `vercel.json` na raiz do projeto:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://gdyvazyqisigvbhnsxui.supabase.co wss://gdyvazyqisigvbhnsxui.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ],
  "rewrites": [{ "source": "/((?!api/.*).*)", "destination": "/index.html" }]
}
```

> **Nota:** O valor de `Content-Security-Policy` acima é um ponto de partida. Testar em staging com `Content-Security-Policy-Report-Only` antes de ativar em produção.

---

### [SEC-04] AuthGuard Aceita Sessão sem Profile — Role Indefinido

| | |
|---|---|
| **Severidade** | ALTO |
| **Categoria** | OWASP A07: Identification and Authentication Failures |
| **Arquivos** | `src/components/auth/AuthGuard.tsx`, `src/hooks/useAuth.ts` |

**Descrição**

Quando `fetchProfile` falha (erro de rede, RLS bloqueando, tabela `profiles` inconsistente), o hook retorna `{ user: User, profile: null, loading: false }`:

```typescript
// useAuth.ts — linhas 57–58
if (error || !data) {
  setState({ user, profile: null, loading: false })  // ← user autenticado, profile null
}
```

O AuthGuard não trata esse caso:

```typescript
// AuthGuard.tsx — linhas 20–27
if (!user) return <Navigate to="/login" replace />   // ← user existe, não redireciona

if (allowedRole && profile?.role !== allowedRole) {
  // profile?.role é undefined, undefined !== 'teacher' é true
  // Redireciona para '/aluno' (pois undefined !== 'teacher')
  return <Navigate to={profile?.role === 'teacher' ? '/professor' : '/aluno'} replace />
}

return <>{children}</>   // ← teacher com profile=null acessa área de aluno autenticado
```

Um professor cujo profile não carregou termina na área do aluno autenticado, podendo interagir com dados de alunos sem o contexto correto de autorização.

**Remediação**

```typescript
// AuthGuard.tsx
if (loading) return <div>Carregando...</div>
if (!user || !profile) return <Navigate to="/login" replace />  // ← verificar ambos
if (allowedRole && profile.role !== allowedRole) {
  return <Navigate to={profile.role === 'teacher' ? '/professor' : '/aluno'} replace />
}
return <>{children}</>
```

---

### [SEC-05] Mensagens de Erro Brutas do Supabase Expostas ao Usuário

| | |
|---|---|
| **Severidade** | ALTO |
| **Categoria** | OWASP A09: Security Logging and Monitoring Failures / CWE-209 |
| **Arquivo** | `src/pages/auth/RegisterPage.tsx` linha 65 |

**Descrição**

Erros do Supabase Auth são propagados diretamente para a UI:

```typescript
// RegisterPage.tsx — linha 65
if (error) {
  setError(error.message)   // ← "User already registered", "Invalid email format", etc.
}
```

Mensagens como `"User already registered"` permitem que um atacante enumere e-mails válidos cadastrados na plataforma, enviando requests de cadastro e observando a diferença de resposta.

**Remediação**

Criar um mapa de erros com mensagens genéricas:

```typescript
const AUTH_ERRORS: Record<string, string> = {
  'User already registered': 'Não foi possível criar a conta. Tente outro e-mail.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
}

const friendlyMessage = AUTH_ERRORS[error.message] ?? 'Ocorreu um erro. Tente novamente.'
setError(friendlyMessage)
```

---

### [SEC-06] Rate Limiting Ausente em Autenticação

| | |
|---|---|
| **Severidade** | ALTO |
| **Categoria** | OWASP A07: Identification and Authentication Failures / CWE-307 |
| **Arquivos** | `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterPage.tsx` |

**Descrição**

Não há proteção contra tentativas repetidas de autenticação: sem throttle, sem lockout, sem CAPTCHA, sem backoff exponencial. Um atacante pode realizar brute force de senhas ou credential stuffing contra qualquer e-mail da plataforma.

**Remediação**

1. **Imediato — Supabase Dashboard:** habilitar *Auth → Rate Limits* (configurar máximo de tentativas por IP/e-mail)
2. **Frontend — backoff após falhas:**

```typescript
const [attempts, setAttempts] = useState(0)
const [blockedUntil, setBlockedUntil] = useState<number | null>(null)

async function handleLogin() {
  if (blockedUntil && Date.now() < blockedUntil) {
    setError(`Aguarde ${Math.ceil((blockedUntil - Date.now()) / 1000)}s antes de tentar novamente.`)
    return
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const next = attempts + 1
    setAttempts(next)
    if (next >= 5) setBlockedUntil(Date.now() + Math.pow(2, next - 4) * 1000)
  }
}
```

3. **Longo prazo:** integrar hCaptcha ou Cloudflare Turnstile após 3 falhas consecutivas

---

### [SEC-07] Campos de Texto Livre sem `maxLength`

| | |
|---|---|
| **Severidade** | ALTO |
| **Categoria** | CWE-400: Uncontrolled Resource Consumption |
| **Arquivos** | NewStudentPage, NewPiecePage, NewExercisePage, PomodoroPage (campo notes) |

**Descrição**

Nenhum `<input type="text">` ou `<textarea>` da aplicação define `maxLength`. Payloads arbitrariamente grandes podem ser enviados ao banco, causando degradação de performance ou bloqueio de recursos.

**Remediação**

Aplicar limites adequados ao domínio:

| Campo | maxLength sugerido |
|---|---|
| Primeiro/Último nome | 100 |
| Título de peça/exercício | 200 |
| Compositor / Autor | 150 |
| Observações / Notas | 2000 |
| Descrição de programa | 500 |

Exemplo:

```tsx
<input type="text" maxLength={100} value={firstName} onChange={...} />
<textarea maxLength={2000} value={notes} onChange={...} />
```

Complementar com `CHECK` constraint no banco: `CHECK (char_length(notes) <= 2000)`.

---

### [SEC-08] JWT de Sessão Armazenado em localStorage

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | CWE-522: Insufficiently Protected Credentials |
| **Arquivo** | `src/lib/supabase.ts` |

**Descrição**

O Supabase SDK armazena o JWT de sessão em `localStorage` por padrão. Qualquer XSS bem-sucedido — mesmo que temporário — pode roubar o token e assumir a sessão do usuário.

```typescript
// supabase.ts — sem configuração de storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
// ↑ usa localStorage implicitamente
```

**Atenuante atual:** não foi identificado uso de `dangerouslySetInnerHTML` no código; React escapa output por padrão, reduzindo a superfície XSS.

**Remediação**

- **Curto prazo:** não há alternative segura trivial para SPAs sem backend próprio. Garantir ausência de XSS (ver controles positivos).
- **Longo prazo:** implementar um proxy backend (Vercel Edge Functions ou servidor Node) que troque o token por um cookie `httpOnly; Secure; SameSite=Strict`, tornando o JWT inacessível ao JavaScript.

---

### [SEC-09] Race Condition TOCTOU na Criação de Aluno

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | CWE-367: Time-of-Check Time-of-Use Race Condition |
| **Arquivo** | `src/pages/teacher/NewStudentPage.tsx` |

**Descrição**

A verificação de e-mail duplicado e o INSERT são operações separadas:

```typescript
// Verificação
const { data: existing } = await supabase
  .from('students').select('id').eq('contact_email', email).single()
if (existing) throw new Error('E-mail já cadastrado')

// INSERT — janela de race condition entre aqui e a verificação acima
await supabase.from('students').insert({ contact_email: email, ... })
```

Duas requisições simultâneas passam na verificação e ambas executam o INSERT, criando registros duplicados.

**Remediação**

1. Adicionar `UNIQUE` constraint no banco: `ALTER TABLE students ADD CONSTRAINT students_email_unique UNIQUE (contact_email);`
2. Tratar o erro `23505` (unique violation) no frontend:

```typescript
if (insertError?.code === '23505') {
  setError('Este e-mail já está cadastrado para outro aluno.')
  return
}
```

---

### [SEC-10] Parâmetros de Rota sem Validação de Formato UUID

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | CWE-20: Improper Input Validation |
| **Arquivos** | Todos os componentes com `useParams()` |

**Descrição**

Parâmetros de URL como `studentId`, `pieceId`, `exerciseId` são usados diretamente em queries sem validação de formato:

```typescript
const { studentId } = useParams()
// studentId pode ser qualquer string — 'abc', '../admin', etc.
const { data } = await supabase.from('students').eq('id', studentId!)
```

O driver do Supabase usa queries parametrizadas, prevenindo SQL injection. Porém, a ausência de validação permite requests malformados que desnecessariamente atingem o banco.

**Remediação**

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(val: string | undefined): val is string {
  return !!val && UUID_REGEX.test(val)
}

// Nos componentes:
const { studentId } = useParams()
if (!isValidUUID(studentId)) return <NotFoundPage />
```

---

### [SEC-11] Invite Vincula `profile_id` Sem Verificar Disponibilidade

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | OWASP A01: Broken Access Control |
| **Arquivo** | `src/pages/auth/RegisterPage.tsx` linha 72–75 |

**Descrição**

```typescript
// RegisterPage.tsx — linhas 72–75
await supabase
  .from('students')
  .update({ profile_id: data.user.id })
  .eq('id', inviteStudentId)
  // ← falta: .is('profile_id', null)
```

Se um aluno já vinculou sua conta e alguém usa o mesmo link de convite, o `profile_id` é sobrescrito.

**Remediação**

```typescript
await supabase
  .from('students')
  .update({ profile_id: data.user.id })
  .eq('id', inviteStudentId)
  .is('profile_id', null)   // ← só vincula se ainda não tiver dono
```

> **Ajuste mínimo imediato** (baixo esforço, alto impacto).

---

### [SEC-12] Fallback de Vinculação por E-mail Inseguro

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | OWASP A01: Broken Access Control |
| **Arquivo** | `src/pages/auth/RegisterPage.tsx` linhas 78–84 |

**Descrição**

Para alunos sem convite que se cadastram como `role='student'`, existe um fallback:

```typescript
// RegisterPage.tsx — linhas 78–84
await supabase
  .from('students')
  .update({ profile_id: data.user.id })
  .eq('contact_email', email)
  .is('profile_id', null)
```

Qualquer pessoa que saiba o e-mail de um aluno cadastrado pode criar uma conta com esse e-mail e assumir o registro do aluno — independentemente de ter recebido convite.

**Remediação**

Remover o bloco do fallback e exigir link de convite para todos os alunos:

```typescript
if (data.user) {
  if (inviteStudentId) {
    await supabase
      .from('students')
      .update({ profile_id: data.user.id })
      .eq('id', inviteStudentId)
      .is('profile_id', null)
  }
  // ← fallback por e-mail removido
}
```

---

### [SEC-13] Ausência de Logout Automático por Inatividade

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | OWASP A07: Identification and Authentication Failures / CWE-613 |
| **Arquivo** | `src/hooks/useAuth.ts` |

**Descrição**

O Supabase renova automaticamente o JWT de sessão indefinidamente enquanto o usuário mantém a aba aberta. Não há timer de inatividade. Em dispositivos compartilhados (tablets em escola de música, por exemplo), a sessão de um professor fica ativa mesmo após ele sair.

**Remediação**

```typescript
// Adicionar em useAuth.ts ou em um hook separado
const INACTIVITY_LIMIT = 30 * 60 * 1000 // 30 minutos

useEffect(() => {
  let timer: ReturnType<typeof setTimeout>
  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(() => supabase.auth.signOut(), INACTIVITY_LIMIT)
  }
  const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart']
  events.forEach(e => window.addEventListener(e, reset, { passive: true }))
  reset()
  return () => {
    clearTimeout(timer)
    events.forEach(e => window.removeEventListener(e, reset))
  }
}, [])
```

---

### [SEC-14] Logs Internos Visíveis em Produção

| | |
|---|---|
| **Severidade** | MÉDIO |
| **Categoria** | CWE-209: Information Exposure Through Error Messages |
| **Arquivo** | `src/pages/auth/RegisterPage.tsx` linhas 76–77 |

**Descrição**

```typescript
if (linkError) console.error('[invite] link error:', linkError.message)
else if (count === 0) console.warn('[invite] 0 rows updated — RLS may be blocking...')
```

Mensagens de debug ficam visíveis nas DevTools de qualquer navegador em produção, revelando detalhes sobre o comportamento das RLS policies e estrutura interna da aplicação.

**Remediação**

Criar utilitário de log condicionado ao ambiente:

```typescript
// src/lib/logger.ts
const isDev = import.meta.env.DEV
export const logger = {
  error: (...args: unknown[]) => isDev && console.error(...args),
  warn:  (...args: unknown[]) => isDev && console.warn(...args),
}

// Uso:
import { logger } from '@/lib/logger'
if (linkError) logger.error('[invite] link error:', linkError.message)
```

---

### [SEC-15] Confirmação de E-mail Desabilitada

| | |
|---|---|
| **Severidade** | BAIXO |
| **Categoria** | OWASP A07: Identification and Authentication Failures |

**Descrição**

O commit `c9158d1` desabilitou intencionalmente a confirmação de e-mail no Supabase (`"desativar confirmação de email"`). Em produção, qualquer pessoa pode criar uma conta usando o e-mail de outra pessoa sem verificação de posse.

**Remediação**

Reabilitar email confirmation no Supabase Dashboard → Authentication → Settings → "Enable email confirmations". Atualizar os fluxos da aplicação para tratar o estado "awaiting confirmation".

---

### [SEC-16] Anon Key Exposta no Bundle JavaScript (By Design)

| | |
|---|---|
| **Severidade** | BAIXO |
| **Categoria** | CWE-522: Insufficiently Protected Credentials |
| **Arquivo** | `src/lib/supabase.ts` |

**Descrição**

`VITE_SUPABASE_ANON_KEY` é visível em `dist/assets/*.js`. Este comportamento é documentado e esperado pelo Supabase para aplicações SPA — a chave anônima é projetada para ser pública. A proteção real é inteiramente delegada às RLS policies.

```typescript
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// ↑ visível em texto claro no bundle de produção
```

**Risco residual:** se alguma tabela tiver RLS desabilitado ou policy com `USING (true)`, a chave exposta permite acesso irrestrito a esses dados.

**Remediação**

- Auditar periodicamente: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — garantir `rowsecurity = true` em todas as tabelas
- Monitorar uso da anon key no Supabase Dashboard → Reports → API
- Configurar alertas para volume anormal de requests

---

### [SEC-17] Variável de Ambiente com Possível Service Key sob Prefixo VITE_

| | |
|---|---|
| **Severidade** | BAIXO |
| **Categoria** | CWE-522: Insufficiently Protected Credentials |
| **Arquivo** | `.env.local` |

**Descrição**

O arquivo `.env.local` contém uma variável com prefixo `VITE_` que pode corresponder a uma service role key do Supabase. Variáveis prefixadas com `VITE_` são incluídas no bundle pelo Vite se referenciadas no código; se inadvertidamente referenciadas em algum momento, a service role key seria exposta — ela contorna completamente o RLS e concede acesso administrativo ao banco.

O código atual em `src/lib/supabase.ts` **não referencia** essa variável, portanto ela não está no bundle atual.

**Remediação**

1. Renomear para `SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `VITE_`) no `.env.local`
2. Nunca referenciar via `import.meta.env` no código frontend
3. Se necessária alguma operação de service role, usar Supabase Edge Functions ou Vercel API Routes (backend isolado)

---

## Pontos Positivos

A auditoria identificou os seguintes controles de segurança já implementados corretamente:

| Controle | Evidência |
|---|---|
| RLS habilitado nas tabelas principais | `schema_v2.sql`, `schema_programs.sql`, `schema_rls_fix.sql` |
| Funções de escopo server-side | `fn_my_teacher_id()`, `fn_my_student_id()` com `SECURITY DEFINER` |
| Sem CVEs nas dependências | `npm audit` retorna zero vulnerabilidades; React 19, Vite 8, Supabase JS 2.107 |
| Lock file commitado | `package-lock.json` presente — builds reproduzíveis |
| `.env.local` protegido | `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`, `.env.production` |
| XSS reflected mitigado | React escapa output por padrão; sem `dangerouslySetInnerHTML` identificado |
| TypeScript strict | Reduz classe de bugs de tipo em runtime |
| Senhas com comprimento mínimo | `minLength={6}` nos campos de senha |
| Separação de roles | AuthGuard com `allowedRole` por rota |
| Confirmação de senha no cadastro | Comparação `password !== confirmPassword` antes do submit |

---

## Roadmap de Remediação

### P0 — Imediato (esta sessão / hoje)

| ID | Ação | Esforço |
|---|---|---|
| SEC-02 | Adicionar `build: { sourcemap: false }` em `vite.config.ts` | 1 linha |
| SEC-11 | Adicionar `.is('profile_id', null)` no UPDATE do invite | 1 linha |
| SEC-04 | Verificar `!profile` no AuthGuard → redirect para `/login` | 2 linhas |
| SEC-17 | Renomear variável VITE_ sensível para sem prefixo VITE_ no `.env.local` | Config |

### P1 — Esta semana

| ID | Ação | Esforço |
|---|---|---|
| SEC-01 | Implementar `invite_token` com expiração de 48h | Médio |
| SEC-03 | Criar `vercel.json` com headers de segurança | Baixo |
| SEC-05 | Mapear mensagens de erro do Supabase para strings genéricas | Baixo |
| SEC-12 | Remover fallback de vinculação por e-mail | 5 linhas |
| SEC-14 | Criar `src/lib/logger.ts` e substituir console.error/warn | Baixo |

### P2 — Próximas 2 semanas

| ID | Ação | Esforço |
|---|---|---|
| SEC-06 | Habilitar rate limiting no Supabase Dashboard + backoff no frontend | Médio |
| SEC-07 | Adicionar `maxLength` em todos os campos de texto livre | Baixo |
| SEC-09 | `UNIQUE` constraint em `students.contact_email` + tratar erro 23505 | Baixo |
| SEC-10 | Validar formato UUID nos `useParams()` antes de queries | Médio |

### P3 — Mês seguinte

| ID | Ação | Esforço |
|---|---|---|
| SEC-08 | Avaliar migração de JWT para httpOnly cookie via proxy backend | Alto |
| SEC-13 | Implementar auto-logout por inatividade (30 min) | Médio |
| SEC-15 | Reabilitar confirmação de e-mail no Supabase | Baixo |
| SEC-16 | Monitorar uso anormal da anon key via Supabase Dashboard | Contínuo |

---

## Apêndice

### Referências

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Application Security Verification Standard (ASVS) 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [CWE-284 — Improper Access Control](https://cwe.mitre.org/data/definitions/284.html)
- [CWE-307 — Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
- [CWE-522 — Insufficiently Protected Credentials](https://cwe.mitre.org/data/definitions/522.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Versões Analisadas

| Pacote | Versão |
|---|---|
| react | 19.2.6 |
| vite | 8.0.12 |
| @supabase/supabase-js | 2.107.0 |
| react-router-dom | 7.17.0 |
| typescript | 5.8.3 |

### Escopo e Limitações

Esta auditoria cobre exclusivamente a análise estática do código-fonte. Os seguintes itens estão fora do escopo e podem ser abordados em uma auditoria futura:

- Testes de penetração dinâmicos (DAST) contra o ambiente de produção
- Análise da configuração interna do Supabase Dashboard (RLS policies ativas, triggers, funções)
- Revisão de segurança da infraestrutura Vercel
- Análise de segurança de dependências transitivas além do `npm audit`
- Testes de engenharia social e phishing

---

*Documento gerado por análise automatizada em 2026-06-08. Recomenda-se revisão por profissional de segurança humano antes de tomar decisões críticas baseadas neste relatório.*
