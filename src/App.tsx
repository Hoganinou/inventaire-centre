import { useState } from 'react'
import './App.css'
import InventairePanel from './components/InventairePanel'
import vehiculeExemple from './models/vehiculeExemple'

function App() {
  return (
    <div>
      <InventairePanel vehicule={vehiculeExemple} />
    </div>
  )
}

export default App
