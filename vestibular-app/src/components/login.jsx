import { useState } from 'react'
import { supabase } from '../SUPABASE'

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

function Login() {
  // modo: 'login' | 'cadastro'
  const [modo, setModo] = useState('login')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const limparMensagens = () => {
    setErro('')
    setSucesso('')
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

  function handleRecuperarSenha() {
    alert(
      'A recuperação de senha é feita manualmente pela equipe. Entre em contato com o administrador.'
    )
  }

  const ehCadastro = modo === 'cadastro'

  return (
    <div
      className="flex items-center justify-center min-h-screen px-4"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="bg-black bg-opacity-75 p-8 rounded-xl text-white w-full max-w-md backdrop-blur-sm border border-gray-800 shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-center text-blue-500">
          {ehCadastro ? 'Criar conta' : 'Entrar no Sistema'}
        </h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          {ehCadastro
            ? 'Crie sua conta de aluno para começar a estudar'
            : 'Faça login para acessar a plataforma'}
        </p>

        {/* Alternância Entrar / Criar conta */}
        <div className="flex gap-1 p-1 bg-gray-900/70 border border-gray-800 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => trocarModo('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              !ehCadastro ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => trocarModo('cadastro')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              ehCadastro ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Criar conta
          </button>
        </div>

        {erro && (
          <div className="bg-red-600 bg-opacity-20 border border-red-500 text-red-400 p-3 rounded mb-4 text-sm text-center">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="bg-emerald-600 bg-opacity-20 border border-emerald-500 text-emerald-400 p-3 rounded mb-4 text-sm text-center">
            {sucesso}
          </div>
        )}

        <form onSubmit={ehCadastro ? handleCadastro : handleLogin} className="space-y-4">
          {ehCadastro && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-300">Nome</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Seu nome"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-300">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-300">Senha</label>
            <div className="relative flex items-center">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 w-full text-sm pr-12"
                placeholder={ehCadastro ? 'Mínimo de 6 caracteres' : '••••••••'}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 text-gray-400 hover:text-gray-200 text-xs font-bold focus:outline-none select-none"
              >
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {!ehCadastro && (
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={handleRecuperarSenha}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors focus:outline-none"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}
          </div>

          {ehCadastro && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-300">Confirmar senha</label>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Repita a senha"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg text-sm mt-4
                       transform transition-all duration-300 ease-in-out
                       hover:scale-[1.02] active:scale-95 disabled:bg-gray-700 disabled:scale-100 disabled:shadow-none
                       shadow-lg shadow-blue-600/30"
          >
            {carregando
              ? 'Carregando...'
              : ehCadastro
                ? 'Criar minha conta'
                : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {ehCadastro ? (
            <>
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={() => trocarModo('login')}
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors focus:outline-none"
              >
                Entrar
              </button>
            </>
          ) : (
            <>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => trocarModo('cadastro')}
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors focus:outline-none"
              >
                Criar conta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
