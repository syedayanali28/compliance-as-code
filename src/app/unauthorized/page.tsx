import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground">
          Your account does not have permission to access this dashboard.
        </p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </div>
  );
}
