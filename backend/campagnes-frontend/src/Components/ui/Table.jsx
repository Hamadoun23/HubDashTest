import { cn } from '@/lib/cn';
import { Card } from '@/Components/ui/Card';

/**
 * Carte-tableau partagee : meme rayon/bordure que `Card`, scroll horizontal
 * interne, et un slot `footer` (pagination) qui reste dans la meme carte au
 * lieu d'un `<Pagination>` pose a cote a la main sur chaque page.
 */
export function Table({ className, footer, children }) {
    return (
        <Card className={cn('overflow-hidden', className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">{children}</table>
            </div>
            {footer}
        </Card>
    );
}

export function TableHead({ className, children }) {
    return (
        <thead className={cn('border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500', className)}>
            {children}
        </thead>
    );
}

export function TableBody({ className, children }) {
    return <tbody className={cn('divide-y divide-ardoise-100', className)}>{children}</tbody>;
}

export default Table;
