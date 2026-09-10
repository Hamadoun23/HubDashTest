import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
    return (
        <select
            ref={ref}
            className={cn(
                'block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-ardoise-900 shadow-sm transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-marque-500/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-ardoise-300 focus:border-marque-500',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
});

export default Select;
