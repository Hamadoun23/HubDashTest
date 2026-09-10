import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Champ "boîte" : la bordure est portée par le <label>, pas par l'<input>.
 * Le reset `border-0 p-0 focus:ring-0` est indispensable — sans lui, le plugin
 * @tailwindcss/forms applique sa propre bordure + padding à l'input et on voit
 * un rectangle imbriqué dans la boîte arrondie.
 */
const INPUT_RESET = 'border-0 bg-transparent p-0 focus:border-0 focus:outline-none focus:ring-0';

export function FieldBox({ label, value, onChange, type = 'text', error, className, ...props }) {
    const isPassword = type === 'password';
    const [visible, setVisible] = useState(false);

    return (
        <div className={className}>
            <div
                className={cn(
                    'flex h-12 items-center gap-2 rounded-xl border bg-white px-4 transition-colors',
                    error
                        ? 'border-red-400 focus-within:border-red-500'
                        : 'border-ardoise-300 focus-within:border-marque-500',
                )}
            >
                <input
                    type={isPassword && visible ? 'text' : type}
                    value={value}
                    onChange={onChange}
                    placeholder={label}
                    aria-label={label}
                    className={cn(
                        INPUT_RESET,
                        'min-w-0 flex-1 text-[15px] text-ardoise-900 placeholder:text-ardoise-400',
                    )}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setVisible((v) => !v)}
                        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        className="-mr-1 shrink-0 rounded-md p-1 text-ardoise-400 transition-colors hover:text-ardoise-700"
                    >
                        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                )}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
    );
}

export function CheckLine({ checked, onChange, children }) {
    return (
        <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-ardoise-600">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-ardoise-300 text-marque-600 focus:ring-marque-500/40"
            />
            <span>{children}</span>
        </label>
    );
}
