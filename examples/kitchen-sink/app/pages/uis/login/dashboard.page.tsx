import cookies from "@redpointgames/framework/cookies";
import { redirect } from "@redpointgames/framework/redirect";

export async function before() {
  let auth = await cookies.encrypted.get("auth");
  if (!auth) {
    redirect("/uis/login");
  }
}

async function logout() {
  "use server";
  cookies.encrypted.destroy("auth");
  redirect("/uis/login");
}

export default function Page() {
  return (
    <div>
      <div>Welcome to the dashboard page!</div>
      <div className="mt-4">
        <form action={logout}>
          <button type="submit" className="text-blue-500 hover:underline">
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
