import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ExecutionNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Execution Not Found</CardTitle>
          <CardDescription className="text-base">
            This execution doesn&apos;t exist or has been removed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <p className="font-medium">Why did this happen?</p>
            <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
              <li>The execution may have been deleted</li>
              <li>You might be using an old or invalid link</li>
              <li>You may not have permission to view this execution</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/execution/history">
                <ArrowLeft className="w-4 h-4 mr-2" />
                View Execution History
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
