import { useState, useEffect } from 'react'
import StepVestibular from './components/StepVestibular'
import StepVestibular2 from './components/StepVestibular2'
import StepVestibular3 from './components/StepVestibular3'
import InterfaceBase from './components/Interface_base'
import Login from './components/login'
import { supabase } from './SUPABASE'

function App() {
  let [user, setUser] = useState(null)
  let [data, setData] = useState({})
  let [step, setStep] = useState(1)
  let [carregandoSessao, setCarregandoSessao] = useState(true)

  // Função essencial: Busca se o usuário já tem um cronograma ativo no Supabase
  async function buscarCronogramaSalvo(userId) {
    try {
      const { data: tabela, error } = await supabase
        .from('cronogramas')
        .select('dados_cronograma')
        .eq('user_id', userId)
        .single()

      if (tabela && tabela.dados_cronograma) {
        // Se achou o cronograma, salva no estado e joga DIRETO para o Step 4 (Dashboard Fixa)
        setData({ cronograma: tabela.dados_cronograma })
        setStep(4)
      } else {
        // Se o usuário é totalmente novo e não tem nada salvo, começa do formulário
        setStep(1)
      }
    } catch (err) {
      // Se houver qualquer erro na consulta ou não achar registro, mantém no fluxo inicial
      setStep(1)
    } finally {
      setCarregandoSessao(false)
    }
  }

  useEffect(() => {
    // 1. Verifica se já existe uma sessão ativa ao carregar a página
    supabase.auth.getSession().then(({ data: { session } }) => {
      const usuario = session?.user ?? null
      setUser(usuario)
      if (usuario) {
        buscarCronogramaSalvo(usuario.id)
      } else {
        setCarregandoSessao(false)
      }
    })

    // 2. Monitora mudanças no estado de login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const usuario = session?.user ?? null
      setUser(usuario)
      if (usuario) {
        buscarCronogramaSalvo(usuario.id)
      } else {
        setCarregandoSessao(false)
        setData({})
        setStep(1)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function handleNext(info) {
    setData(prevData => ({ ...prevData, ...info }))
    setStep(prevStep => prevStep + 1)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setData({})
    setStep(1)
  }

  if (carregandoSessao) {
    return (
      <div className="bg-gray-950 min-h-screen flex items-center justify-center text-white font-semibold">
        Carregando seu painel...
      </div>
    )
  }

  if (!user) {
  return <Login />
}
  return (
    <div className="bg-gray-950 min-h-screen relative">
     
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-4 rounded-lg transition shadow-md z-50 transform hover:scale-105 active:scale-95"
      >
        Sair da Conta
      </button>

      
      {step === 1 && <StepVestibular onNext={handleNext} />}
      {step === 2 && <StepVestibular2 onNext={handleNext} />}
      {step === 3 && (
        <StepVestibular3
          cronograma={data.cronograma}
          onSaveSuccess={() => buscarCronogramaSalvo(user.id)}
        />
      )}

     
      {step === 4 && <InterfaceBase cronograma={data.cronograma} userId={user.id} />}
    </div>
  )
}

export default App
