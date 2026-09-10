import { cn } from '@/lib/cn';
import { Card, CardBody } from '@/Components/ui/Card';
import Sparkline from '@/Components/ui/Sparkline';

const iconTones = {
    orange: 'bg-marque-50 text-marque-700',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-ardoise-100 text-ardoise-600',
};

function hasTrend(values) {
    return Array.isArray(values) && values.some((v) => v > 0);
}

export default function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    tone = 'orange',
    trend,
    dark = false,
    textValue = false,
    className,
}) {
    const showTrend = hasTrend(trend);

    return (
        <Card className={cn(dark && 'border-0 bg-marque-700 text-white', className)}>
            <CardBody className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p
                        className={cn(
                            'truncate text-xs font-medium uppercase tracking-wide',
                            dark ? 'text-white/70' : 'text-ardoise-500',
                        )}
                    >
                        {label}
                    </p>
                    {/* Les valeurs textuelles (noms) sont plus longues : taille réduite + 2 lignes
                        au lieu d'une troncature qui coupait « Adiaratou A ... ». */}
                    <p
                        className={cn(
                            'mt-1.5 font-semibold',
                            textValue ? 'line-clamp-2 text-lg leading-snug' : 'truncate text-2xl',
                            dark ? 'text-white' : 'text-ardoise-900',
                        )}
                    >
                        {value}
                    </p>
                    {sub && !dark && <p className="mt-1 truncate text-xs text-ardoise-500">{sub}</p>}
                </div>
                {showTrend ? (
                    <Sparkline values={trend} color={dark ? '#ffffff' : '#d03e0d'} />
                ) : (
                    Icon && (
                        <span
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                dark ? 'bg-white/15 text-white' : iconTones[tone],
                            )}
                        >
                            <Icon className="h-4.5 w-4.5" strokeWidth={2} size={18} />
                        </span>
                    )
                )}
            </CardBody>
        </Card>
    );
}
