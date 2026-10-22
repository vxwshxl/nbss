import { ErrorScreen } from "@/components/errors/error-screen";

export default function Forbidden() {
  return <ErrorScreen code={403} />;
}
