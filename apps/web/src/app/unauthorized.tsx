import Link from "next/link";

import { ErrorScreen } from "@/components/errors/error-screen";

export default function Unauthorized() {
  return (
    <ErrorScreen
      code={401}
      action={
        <Link href="/login" className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-ink-fg">
          Sign in
        </Link>
      }
    />
  );
}
