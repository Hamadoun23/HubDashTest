import { Link } from '@inertiajs/react';
import { cn } from '@/lib/cn';

const variants = {
    // marque-700, pas marque-500 : du texte blanc sur l'orange de marque
    // (#FF6A3A) ne tient que 2.85:1 de contraste, sous le seuil WCAG AA. Le
    // module RH du hub a deja fait ce choix pour la meme raison.
    primary: 'bg-marque-700 text-white hover:bg-marque-800 shadow-sm',
    secondary: 'bg-ardoise-900 text-white hover:bg-ardoise-800 shadow-sm',
    outline: 'border border-ardoise-300 text-ardoise-700 bg-white hover:bg-ardoise-50',
    ghost: 'text-ardoise-600 hover:bg-ardoise-100 hover:text-ardoise-900',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-sm gap-2',
    lg: 'h-11 px-6 text-sm gap-2',
};

export default function Button({
    href,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className,
    children,
    ...props
}) {
    const classes = cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marque-500/40 focus-visible:ring-offset-1',
        disabled && 'pointer-events-none opacity-50',
        variants[variant],
        sizes[size],
        className,
    );

    if (href && !disabled) {
        return (
            <Link href={href} className={classes} {...props}>
                {children}
            </Link>
        );
    }

    return (
        <button type="button" className={classes} disabled={disabled} {...props}>
            {children}
        </button>
    );
}
