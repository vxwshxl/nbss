import { Redirect } from "expo-router";
import { useCallback } from "react";

import { useLoader } from "@/hooks/use-loader";
import { supabase } from "@/lib/supabase";
import { ClientHome } from "@/screens/client-home";

/** A brand-new client with nothing booked lands on the booking form, as on the website. */
export default function ClientSiteRoute() {
  const { data } = useLoader(
    useCallback(async () => {
      const [sites, requests] = await Promise.all([
        supabase.from("sites").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id", { count: "exact", head: true }),
      ]);
      return !sites.count && !requests.count;
    }, []),
  );
  if (data) return <Redirect href="/(client)/book" />;
  return <ClientHome />;
}
