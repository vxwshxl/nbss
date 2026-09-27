import { redirect } from "next/navigation";

/** Sign-in moved to /login; old bookmarks and the app's links still land there. */
export default function LegacyLogin() {
  redirect("/login");
}
