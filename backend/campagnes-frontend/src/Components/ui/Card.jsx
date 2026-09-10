import { cn } from '@/lib/cn';

export function Card({ className, children, interactive = false, ...props }) {
    return (
        <div
            className={cn(
                'rounded-3xl border border-ardoise-200 bg-white shadow-card',
                interactive && 'transition-colors hover:border-ardoise-300',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className, children, ...props }) {
    return (
        <div className={cn('border-b border-ardoise-100 px-5 py-4', className)} {...props}>
            {children}
        </div>
    );
}

export function CardTitle({ className, children, ...props }) {
    return (
        <h3 className={cn('text-sm font-semibold text-ardoise-900', className)} {...props}>
            {children}
        </h3>
    );
}

export function CardBody({ className, children, ...props }) {
    return (
        <div className={cn('p-5', className)} {...props}>
            {children}
        </div>
    );
}
