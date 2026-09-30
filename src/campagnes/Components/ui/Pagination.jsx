import { Link } from '@inertiajs/react';
import { cn } from '@campagnes/lib/cn';

export default function Pagination({ links, from, to, total }) {
    if (!links || links.length <= 3) return null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
                {from}–{to} sur {total}
            </p>
            <div className="flex flex-wrap items-center gap-1">
                {links.map((link, i) => (
                    <Link
                        key={i}
                        href={link.url || '#'}
                        preserveScroll
                        className={cn(
                            'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium',
                            link.active ? 'bg-gda-orange text-white' : 'text-gray-500 hover:bg-gray-100',
                            !link.url && 'pointer-events-none opacity-40',
                        )}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </div>
        </div>
    );
}
