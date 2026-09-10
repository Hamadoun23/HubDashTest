import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
    return (
        <input
            ref={ref}
            className={cn(
                'block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-ardoise-900 shadow-sm transition-colors',
                'placeholder:text-ardoise-400',
                'focus:outline-none focus:ring-2 focus:ring-marque-500/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-ardoise-300 focus:border-marque-500',
                className,
            )}
            {...props}
        />
    );
});

export const PasswordInput = forwardRef(function PasswordInput({ className, error, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Input
                ref={ref}
                type={visible ? 'text' : 'password'}
                error={error}
                className={cn('pr-10', className)}
                {...props}
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ardoise-400 hover:text-ardoise-600"
            >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
});

export const Textarea = forwardRef(function Textarea({ className, error, ...props }, ref) {
    return (
        <textarea
            ref={ref}
            className={cn(
                'block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-ardoise-900 shadow-sm transition-colors',
                'placeholder:text-ardoise-400',
                'focus:outline-none focus:ring-2 focus:ring-marque-500/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-ardoise-300 focus:border-marque-500',
                className,
            )}
            {...props}
        />
    );
});

export function Label({ className, children, ...props }) {
    return (
        <label className={cn('mb-1.5 block text-sm font-medium text-ardoise-700', className)} {...props}>
            {children}
        </label>
    );
}

export function FieldError({ children }) {
    if (!children) return null;
    return <p className="mt-1.5 text-xs text-red-600">{children}</p>;
}
