import { redirect } from "next/navigation";

/**
 * `/admin` was the old operations page, behind its own separate login. Both are
 * gone: there is now one sign-in at /console/login that routes each person to
 * their own landing page by role.
 *
 * This redirect stays because the URL is in people's bookmarks and browser
 * history. The console's middleware handles anyone who is not signed in.
 */
export default function AdminRedirect() {
  redirect("/console/submissions");
}
