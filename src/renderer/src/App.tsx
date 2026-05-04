function App(): React.ReactElement {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <h1 className="text-xl font-bold mb-4">OneChat</h1>
        <p className="text-gray-400 text-sm">AI services will appear here</p>
      </aside>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <h2 className="text-2xl mb-2">Welcome to OneChat</h2>
          <p>Select an AI service to start chatting</p>
        </div>
      </main>
    </div>
  )
}

export default App
