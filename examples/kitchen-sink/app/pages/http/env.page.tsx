import { env } from "@twofold/framework/env";

export default function EnvPage() {
  const keys = env.keys();
  const list: React.ReactNode[] = [];
  for (const key of keys) {
    list.push(
      <li key={key}>
        <strong>{key}</strong>: {env[key]}
      </li>,
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tighter">Env</h1>
      <ul className="pt-3">{list}</ul>
    </div>
  );
}
