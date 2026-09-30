import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TiroirMobile } from './components/TiroirMobile';
import { TopBar } from './components/TopBar';

export default function App() {
  const [menuMobile, setMenuMobile] = useState(false);
  const fermerMenu = useCallback(() => setMenuMobile(false), []);

  return (
    <div
      className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/motif-orange.jpg')" }}
    >
      {/* Barre latérale : fixe sur grand écran, en tiroir sur téléphone. */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <TiroirMobile ouvert={menuMobile} onFermer={fermerMenu}>
        <Sidebar />
      </TiroirMobile>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenu={() => setMenuMobile(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
