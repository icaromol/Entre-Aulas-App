cat > README.md << 'EOF'
# Entre Aulas App 🎵

Plataforma de gestão pedagógica musical para professores e alunos.

## Sobre

O **Entre Aulas** é uma aplicação web responsiva que permite ao professor gerenciar alunos, repertório, metas e planos de estudo semanais — e ao aluno acompanhar, registrar e cronometrar seu estudo diário.

## Funcionalidades

- Gestão de alunos com disponibilidade semanal configurável
- Repertório com checklist de progresso por peça e exercício
- Metas vinculadas a itens da checklist
- Plano de estudo semanal com distribuição por dia
- Pomodoro com ciclos configuráveis
- Registro de sessões de estudo com comentários
- Concertos e recitais com acompanhamento de preparo

## Stack

- [React](https://react.dev) + [Vite](https://vitejs.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) — Auth, Banco de dados, Storage

## Rodando localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

Crie um arquivo `.env.local` na raiz com:

```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

## Licença

Privado — todos os direitos reservados.
EOF