import Link from 'next/link';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                AI Teaching Platform
              </Link>
              <nav className="hidden md:flex space-x-6">
                <Link
                  href="/"
                  className="text-gray-700 hover:text-indigo-600 transition-colors font-medium"
                >
                  Start Lesson
                </Link>
                <Link
                  href="/lessons/history"
                  className="text-gray-700 hover:text-indigo-600 transition-colors font-medium"
                >
                  History
                </Link>
              </nav>
            </div>
            <div className="text-sm text-gray-500 font-medium">Guest Mode</div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
