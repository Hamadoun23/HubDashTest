import { ChevronDown, Command, Crown, Menu, Moon } from 'lucide-react';
import { AvatarStack, Avatar } from './ui/Avatar';

export function TopBar() {
  return (
    <header className="flex items-center justify-end border-b border-border bg-surface/40 px-8 py-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 backdrop-blur-sm">
          <Crown size={14} className="text-accent2" />
          <span className="text-xs font-semibold text-white">Membre Pro</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 backdrop-blur-sm">
          <Command size={14} className="text-muted" />
          <span className="text-xs font-semibold text-muted">Raccourcis</span>
        </div>

        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface2 backdrop-blur-sm">
          <Moon size={14} className="text-muted" />
        </button>

        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-2 py-1.5 backdrop-blur-sm">
          <AvatarStack labels={['CH', 'JL']} size={22} />
          <span className="pr-1 text-xs font-semibold text-muted">+2</span>
        </div>

        <button className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-xs font-semibold text-white">Portfolio</span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        <button className="flex items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 backdrop-blur-sm">
          <Menu size={14} className="text-muted" />
          <span className="text-xs font-semibold text-muted">Menu</span>
        </button>

        <Avatar label="Hamadoun Cissé" size={34} />
      </div>
    </header>
  );
}
