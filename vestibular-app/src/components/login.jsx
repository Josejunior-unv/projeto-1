import { useState } from 'react'
import { supabase } from '../SUPABASE' 

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    // Chamada oficial de autenticação do Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    })

    setCarregando(false)

    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    } else {
      
      onLoginSuccess(data.user)
    }
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
      <div className="bg-black bg-opacity-75 p-8 rounded-xl text-white w-full max-w-md backdrop-blur-sm border border-gray-800">
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
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-300">Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2"
          >
            {carregando ? 'Carregando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login