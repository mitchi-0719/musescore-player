export const Header = () => {
  return (
    <header className="sticky top-0 right-0 left-0 z-10 bg-gray-800 text-white">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold">MuseScore Player</h1>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <a href="/" className="hover:text-blue-300">
                Home
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
