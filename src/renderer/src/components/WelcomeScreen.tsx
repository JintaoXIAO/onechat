export function WelcomeScreen() {
  return (
    <main className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="text-center text-gray-400 max-w-md">
        <div className="text-5xl mb-4">💬</div>
        <h2 className="text-2xl font-semibold text-gray-200 mb-3">Welcome to OneChat</h2>
        <p className="mb-6">
          Select an AI service from the sidebar to start chatting.
          The service will load in this area.
        </p>
        <div className="bg-gray-800 rounded-lg p-4 text-left text-sm space-y-2">
          <p className="text-gray-300 font-medium">API Endpoint:</p>
          <code className="block bg-gray-900 rounded px-3 py-2 text-green-400 font-mono text-xs">
            http://localhost:11434/v1/chat/completions
          </code>
          <p className="text-gray-500 text-xs mt-2">
            Use this endpoint in any OpenAI-compatible tool to access your AI services.
          </p>
        </div>
      </div>
    </main>
  )
}
