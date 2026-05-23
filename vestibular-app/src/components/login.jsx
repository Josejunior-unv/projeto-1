import { useState } from 'react'
import { supabase } from '../SUPABASE'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    })

    setCarregando(false)

    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)

    }  else {
  // onAuthStateChange no App.jsx cuida do resto automaticamente
}


    } else {
      onLoginSuccess(data.user)
    }

  }

  function handleAvisoManual(funcionalidade) {
    alert(`O sistema de ${funcionalidade} está sendo gerenciado manualmente pelos administradores. Entre em contato com a equipe para obter suporte.`)
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen px-4"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <div className="bg-black bg-opacity-75 p-8 rounded-xl text-white w-full max-w-md backdrop-blur-sm border border-gray-800 shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-center text-blue-500">Entrar no Sistema</h2>
        <p className="text-sm text-gray-400 text-center mb-6">Faça login para acessar a plataforma</p>

        {erro && (
          <div className="bg-red-600 bg-opacity-20 border border-red-500 text-red-400 p-3 rounded mb-4 text-sm text-center">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 text-gray-400 hover:text-gray-200 text-xs font-bold focus:outline-none select-none"
              >
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {/* Link posicionado abaixo do campo, alinhado à direita */}
            <div className="text-right mt-1">
              <button
                type="button"
                onClick={() => handleAvisoManual('recuperação de senha')}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors focus:outline-none"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg text-sm mt-4
                       transform transition-all duration-300 ease-in-out
                       hover:scale-[1.02] active:scale-95 disabled:bg-gray-700 disabled:scale-100 disabled:shadow-none
                       shadow-lg shadow-blue-600/30"
          >
            {carregando ? 'Carregando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Não tem uma conta?{' '}
          <button
            type="button"
            onClick={() => handleAvisoManual('cadastro de usuários')}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors focus:outline-none"
          >
            Criar conta
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
