import { forwardRef } from 'react';
import { cn } from '@campagnes/lib/cn';

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
    return (
        <select
            ref={ref}
            className={cn(
                'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-gda-orange/30',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-300 focus:border-gda-orange',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
});

export default Select;
