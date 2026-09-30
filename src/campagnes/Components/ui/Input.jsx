import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@campagnes/lib/cn';

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
    return (
        <input
            ref={ref}
            className={cn(
                'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-gda-orange/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-300 focus:border-gda-orange',
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
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
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
                'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-gda-orange/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-300 focus:border-gda-orange',
                className,
            )}
            {...props}
        />
    );
});

export function Label({ className, children, ...props }) {
    return (
        <label className={cn('mb-1.5 block text-sm font-medium text-gray-700', className)} {...props}>
            {children}
        </label>
    );
}

export function FieldError({ children }) {
    if (!children) return null;
    return <p className="mt-1.5 text-xs text-red-600">{children}</p>;
}
