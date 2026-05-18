import { useState } from 'react'

function StepVestibular({ onNext }) {
  let [vestibular, setVestibular] = useState("ENEM")

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >

      <div className="flex flex-row gap-8">

        <div className="bg-black bg-opacity-60 p-8 rounded-xl text-white">
          <h1 className="text-3xl font-bold mb-4">Bem vindo!</h1>
          <p className="text-gray-300">Seu plano de estudos personalizado para o vestibular.</p>
          <h3 className="text-10 text-lg mt-4 text-gray-400">Este site tem como propósito ajudar você 
            a acompanhar e entender seu desempenho diário e mensal por meio de cronogramas, estatísticas e métricas próprias.
             Essas informações oferecem um norte claro sobre sua média de acertos e sua evolução ao longo do tempo.</h3>

        </div>

        <div className="bg-black bg-opacity-60 p-7 rounded-xl text-white flex flex-col gap-1 w-96">
          <h2 className="text-2xl font-bold">Escolha seu vestibular:</h2>

          <button className="bg-blue-600 text-white px-7 py-2 rounded-lg" onClick={() => setVestibular("ENEM")}>ENEM</button>
          <button className="bg-blue-600 text-white px-7 py-2 rounded-lg" onClick={() => setVestibular("UERJ")}>UERJ</button>
          <button className="bg-blue-600 text-white px-7 py-2 rounded-lg" onClick={() => setVestibular("UNICAMP")}>UNICAMP</button>

          <p className="text-sm text-gray-400">Escolhido: {vestibular}</p>

          <button className="bg-green-600 text-white px-6 py-2 rounded-lg" onClick={() => onNext(vestibular)}>Continuar</button>
        </div>

      </div>

    </div>
  )
}

export default StepVestibular