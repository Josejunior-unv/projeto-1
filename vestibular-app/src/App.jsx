import { useState } from 'react'
import StepVestibular from './components/StepVestibular'
import StepVestibular2 from './components/StepVestibular2'
import StepVestibular3 from './components/StepVestibular3'

function App() {
  let [data, setData] = useState({})
  let [step, setStep] = useState(1)

  function handleNext(info) {
    setData(prevData => {
      const newData = { ...prevData, ...info }
      console.log("Dados acumulados:", newData)
      return newData
    })
    
    setStep(prevStep => prevStep + 1)
  }

  function handleReiniciar() {
    setData({})
    setStep(1)
  }

  return (
    <div className="bg-gray-950 min-h-screen">
      {step === 1 && <StepVestibular onNext={handleNext} />}
      {step === 2 && <StepVestibular2 onNext={handleNext} />}
      {step === 3 && <StepVestibular3 cronograma={data.cronograma} onReset={handleReiniciar} />}
    </div>
  )
}

export default App