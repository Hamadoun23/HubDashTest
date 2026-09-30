import { cn } from '@campagnes/lib/cn';
import { Card } from '@campagnes/Components/ui/Card';

const iconTones = {
    orange: 'bg-orange-50 text-gda-orange',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-600',
};

export default function StatCard({ label, value, sub, icon: Icon, tone = 'orange', className }) {
    return (
        <Card className={cn('p-5', className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
                    {sub && <p className="mt-1 truncate text-xs text-gray-500">{sub}</p>}
                </div>
                {Icon && (
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconTones[tone])}>
                        <Icon className="h-4.5 w-4.5" strokeWidth={2} size={18} />
                    </span>
                )}
            </div>
        </Card>
    );
}
