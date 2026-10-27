import LoginForm from "@/components/login-form";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const problem = params.error === "account" || params.error === "configuration" ? params.error : "";
  return <LoginForm problem={problem} />;
}
