import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Flame, GraduationCap, BookOpenCheck, TrendingUp } from 'lucide-react'
import { supabase } from '../SUPABASE'
import { Botao, CampoTexto, Alerta } from './ui'

// Traduz as mensagens de erro mais comuns do Supabase para o usuário final.
function traduzErro(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Este e-mail já está cadastrado. Faça login.'
  if (m.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'E-mail inválido.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('signups not allowed')) return 'Cadastro desativado no momento. Fale com o administrador.'
  return msg || 'Ocorreu um erro. Tente novamente.'
}

const PILARES = [
  { icone: BookOpenCheck, titulo: 'Provas e materiais', texto: 'Biblioteca completa das provas da UERJ, organizada por ano e matéria.' },
  { icone: GraduationCap, titulo: 'Questões e simulados', texto: 'Banco oficial do ENEM com correção instantânea e ranking.' },
  { icone: TrendingUp, titulo: 'Evolução visível', texto: 'Estatísticas automáticas do seu desempenho em cada matéria.' },
]

function Login() {
  // modo: 'login' | 'cadastro'
  const [modo, setModo] = useState('login')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const limparMensagens = () => {
    setErro('')
    setSucesso('')
    setAviso('')
  }

  function trocarModo(novo) {
    setModo(novo)
    limparMensagens()
    setSenha('')
    setConfirmarSenha('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    setCarregando(false)

    if (error) setErro(traduzErro(error.message))
    // Em caso de sucesso, o redirecionamento é feito automaticamente pelo
    // listener onAuthStateChange no App.jsx.
  }

  async function handleCadastro(e) {
    e.preventDefault()
    limparMensagens()

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)

    // Cadastro SEMPRE como aluno: não gravamos nenhum cargo aqui. O App assume
    // 'aluno' por padrão quando não há registro em `profiles`. Contas de
    // administrador são criadas manualmente (cargo='admin' na tabela profiles).
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome: nome.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    setCarregando(false)

    if (error) {
      setErro(traduzErro(error.message))
      return
    }

    if (data?.session) {
      // Confirmação de e-mail desativada: já entra direto (o listener redireciona).
      setSucesso('Conta criada com sucesso! Entrando...')
    } else {
      // Confirmação de e-mail ativada: precisa confirmar antes de entrar.
      setSucesso('Conta criada! Enviamos um e-mail de confirmação — confirme para entrar.')
      setModo('login')
      setSenha('')
      setConfirmarSenha('')
    }
  }

  const ehCadastro = modo === 'cadastro'

  return (
    <div className="min-h-screen bg-ink-950 lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ===== PAINEL DA MARCA ===== */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-black p-12">
        {/* brilho dourado ambiente */}
        <div
          aria-hidden
          className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C042 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-52 -right-32 w-[480px] h-[480px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C042 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex items-center gap-2 text-gold-400">
          <Flame size={20} strokeWidth={2.5} />
          <span className="font-display font-bold tracking-wide text-sm text-ink-200 uppercase">
            Pré-Vestibular UERJ Para Todos
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 max-w-lg"
        >
          <img
            src="/logo-uerj.jpeg"
            alt="Pré-Vestibular UERJ Para Todos"
            className="w-64 mb-10 select-none pointer-events-none"
            draggable={false}
          />
          <h1 className="font-display text-4xl font-black text-white leading-[1.1] tracking-tight">
            Sua aprovação começa
            <br />
            com um bom plano.
          </h1>
          <p className="text-ink-300 mt-4 leading-7">
            Cronograma personalizado, provas anteriores, simulados e estatísticas
            — tudo em um só lugar, feito para quem vai encarar a UERJ.
          </p>
        </motion.div>

        <div className="relative z-10 grid gap-5">
          {PILARES.map((p, i) => (
            <motion.div
              key={p.titulo}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.12, duration: 0.5 }}
              className="flex items-start gap-3.5"
            >
              <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 flex items-center justify-center">
                <p.icone size={17} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold text-white">{p.titulo}</p>
                <p className="text-[13px] text-ink-400 leading-5 mt-0.5">{p.texto}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ===== FORMULÁRIO ===== */}
      <div className="flex items-center justify-center min-h-screen lg:min-h-0 px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* marca no mobile (o painel esquerdo some) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img
              src="/logo-uerj.jpeg"
              alt="Pré-Vestibular UERJ Para Todos"
              className="w-40 rounded-2xl select-none"
              draggable={false}
            />
          </div>

          <h2 className="font-display text-2xl font-black text-white tracking-tight">
            {ehCadastro ? 'Criar sua conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-sm text-ink-400 mt-1.5 mb-7">
            {ehCadastro
              ? 'Leva menos de um minuto — e o estudo começa hoje.'
              : 'Entre para continuar seus estudos.'}
          </p>

          {/* Alternância Entrar / Criar conta */}
          <div className="relative flex p-1 bg-ink-900 border border-white/[0.06] rounded-xl mb-6">
            {['login', 'cadastro'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                className={`relative flex-1 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                  modo === m ? 'text-ink-950' : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {modo === m && (
                  <motion.span
                    layoutId="seletor-modo"
                    className="absolute inset-0 bg-gold-400 rounded-lg"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="popLayout">
            {erro && (
              <Alerta key="erro" variante="erro" className="mb-4">
                {erro}
              </Alerta>
            )}
            {sucesso && (
              <Alerta key="sucesso" variante="sucesso" className="mb-4">
                {sucesso}
              </Alerta>
            )}
            {aviso && (
              <Alerta key="aviso" variante="aviso" className="mb-4">
                {aviso}
              </Alerta>
            )}
          </AnimatePresence>

          <form onSubmit={ehCadastro ? handleCadastro : handleLogin} className="space-y-4">
            {ehCadastro && (
              <CampoTexto
                rotulo="Nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            )}

            <CampoTexto
              rotulo="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
            />

            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-300">Senha</span>
                <div className="relative">
                  <CampoTexto
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder={ehCadastro ? 'Mínimo de 6 caracteres' : '••••••••'}
                    autoComplete={ehCadastro ? 'new-password' : 'current-password'}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200 transition-colors"
                  >
                    {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {!ehCadastro && (
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAviso(
                        'A recuperação de senha é feita pela equipe. Fale com o administrador do curso.',
                      )
                    }
                    className="text-xs text-ink-400 hover:text-gold-300 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}
            </div>

            {ehCadastro && (
              <CampoTexto
                rotulo="Confirmar senha"
                type={mostrarSenha ? 'text' : 'password'}
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            )}

            <Botao
              type="submit"
              disabled={carregando}
              tamanho="lg"
              className="w-full mt-2"
            >
              {carregando
                ? 'Entrando...'
                : ehCadastro
                  ? 'Criar minha conta'
                  : 'Entrar'}
            </Botao>
          </form>

          <p className="mt-7 text-center text-sm text-ink-400">
            {ehCadastro ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
            <button
              type="button"
              onClick={() => trocarModo(ehCadastro ? 'login' : 'cadastro')}
              className="text-gold-300 hover:text-gold-200 font-semibold transition-colors"
            >
              {ehCadastro ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
