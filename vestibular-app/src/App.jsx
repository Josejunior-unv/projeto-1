import { useState } from 'react'
import StepVestibular from './components/StepVestibular'
import StepVestibular2 from './components/StepVestibular2'

function App() {
let [data, setData] = useState({})
let [step, setStep] = useState(1)
function handleNext(info) {
  setData(info)
  console.log(info) 
  setStep(2)
}

  return (
  <div className="bg-gray-950 min-h-screen">
    {step === 1 && <StepVestibular onNext={handleNext} />}
    {step === 2 && <StepVestibular2 onNext={handleNext} />} 
    </div>
  )
}

export default App