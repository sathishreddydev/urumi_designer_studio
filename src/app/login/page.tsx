import { LoginForm } from "./login-form";
import { getStudio } from "@/lib/multi-tenant/studio";

/**
 * Login page — server component so we can read studio branding
 * from headers and pass it to the client-side form.
 */
export default async function LoginPage() {
  const studio = await getStudio();

  return (
    <LoginForm
      brandName={studio.brandName}
      logoUrl={studio.logoUrl}
    />
  );
}
