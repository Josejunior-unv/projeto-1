let materias = [
  { nome: "Matemática", peso: 1 },
  { nome: "Português", peso: 1 },
  { nome: "Física", peso: 1 },
  { nome: "Química", peso: 1 },
  { nome: "Biologia", peso: 1 },
  { nome: "História", peso: 1 },
  { nome: "Geografia", peso: 1 },
  { nome: "Inglês", peso: 1 },
  { nome: "Redação", peso: 1 },
  { nome: "Filosofia", peso: 1 }
]

function calcularCronograma(dias, horas, listaMaterias) {
  let T = dias * horas
  let SP = 0

  listaMaterias.forEach(function(materia) {
    SP = SP + (materia.peso || 1)
  })

  if (SP === 0) SP = 1

  let resultado = []
  
  if (dias >= 4) {
    listaMaterias.forEach(function(materia) {
      let pesoAtual = materia.peso || 1
      let Ti = (pesoAtual / SP) * T
      resultado.push({
        nome: materia.nome,
        horas: Ti.toFixed(1)
      })
    })
  } 
  else if (dias === 3) {
    listaMaterias.forEach(function(materia) {
      let pesoAtual = materia.peso || 1
      let Ti = (pesoAtual / SP) * T
      if (Ti < 1) Ti = 1
      resultado.push({
        nome: materia.nome,
        horas: Ti.toFixed(1)
      })
    })
  } 
  else {
    listaMaterias.forEach(function(materia) {
      resultado.push({
        nome: materia.nome,
        horas: "1.5"
      })
    })
  }

  return resultado
}

export { materias, calcularCronograma }