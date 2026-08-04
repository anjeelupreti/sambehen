import Link from 'next/link';
import { FileQuestionIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Not found.
 *
 * The wording is deliberate and must not become "you do not have access".
 * The API cannot distinguish a record that never existed from one in
 * another manager's chain, and it does so on purpose — telling the two
 * apart here would confirm the record exists and undo the scoping.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileQuestionIcon className="text-muted-foreground size-5" />
            Not found
          </CardTitle>
          <CardDescription>This record does not exist, or it is not one of yours.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
