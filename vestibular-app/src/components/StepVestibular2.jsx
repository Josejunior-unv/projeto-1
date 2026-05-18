import { useState } from 'react'

function StepVestibular2({ onNext }) {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <h1 className="text-white text-2xl">Step 2 - Nível por matéria</h1>
    </div>
  )
}

export default StepVestibular2