import Link from "@twofold/framework/link";

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-black tracking-tighter">
        Rewrite target page
      </h1>
      <p className="mt-3">
        Currently on <strong>A</strong>.
      </p>
      <p className="mt-3">
        This page exists to test link loads via RSC correctly preserve rewritten
        URLs.
      </p>
      <ul className="mt-3">
        <li>
          <Link href="/routing/rewrites/a/nested">A</Link>
        </li>
        <li>
          <Link href="/routing/rewrites/b/nested">B</Link>
        </li>
      </ul>
    </div>
  );
}
