import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
let nome = "jose"
console.log(nome)
let idade = 18
if (idade >= 18) {
  console.log("você é maior de idade")
} else {
  console.log("você é menor de idade")
}
let vestibulares =["Enem", "Uerj", "Unicamp"]
vestibulares.forEach((vestibular) => {
  console.log(vestibular)
})