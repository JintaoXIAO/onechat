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
      </div>
    </main>
  )
}
