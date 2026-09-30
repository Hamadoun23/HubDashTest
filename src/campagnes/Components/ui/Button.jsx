import { Link } from '@inertiajs/react';
import { cn } from '@campagnes/lib/cn';

const variants = {
    primary: 'bg-gda-orange text-white hover:bg-orange-600 shadow-sm',
    secondary: 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
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
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gda-orange/40 focus-visible:ring-offset-1',
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
