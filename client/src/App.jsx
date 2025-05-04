import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="flex bg-white justify-center items-center bg-gray-100">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 className="text-4xl font-bold text-center text-blue-500">Vite + React</h1>
      <div className="card p-4 border rounded shadow-lg text-center">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={() => setCount((count) => count + 1)}
        >
          count is {count}
        </button>
        <p className="mt-2 text-gray-600">
          Edit <code className="bg-gray-200 px-1 rounded">src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs text-center text-gray-500 mt-4">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
