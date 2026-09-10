import { cn } from '@/lib/cn';

const tones = {
    neutral: 'bg-ardoise-100 text-ardoise-700 ring-ardoise-200',
    orange: 'bg-marque-50 text-marque-700 ring-marque-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
};

export default function Badge({ tone = 'neutral', className, children }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                tones[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}
