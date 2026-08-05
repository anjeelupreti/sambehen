import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: number | null;
  className?: string;
}) {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4 pb-2">
        <CardDescription className="text-xs font-medium tracking-wide uppercase">
          {label}
        </CardDescription>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">{value}</CardTitle>
          {trend !== undefined && trend !== null && (
            <div
              className={cn(
                'flex items-center text-sm font-medium',
                trend > 0
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : trend < 0
                    ? 'text-rose-600 dark:text-rose-500'
                    : 'text-muted-foreground',
              )}
            >
              {trend > 0 ? (
                <ArrowUpIcon className="mr-1 h-4 w-4" />
              ) : trend < 0 ? (
                <ArrowDownIcon className="mr-1 h-4 w-4" />
              ) : (
                <ArrowRightIcon className="mr-1 h-4 w-4" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
      </CardHeader>
      {hint ? (
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
