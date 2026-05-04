import { PageProps } from "@twofold/framework/types";

export default function FilePage(
  props: PageProps<"folder" | "file" | "extra">,
) {
  return (
    <div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          &#123;params.folder&#125;
        </span>{" "}
        is: {props.params.folder}
      </div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          &#123;params.file&#125;
        </span>{" "}
        is: {props.params.file}
      </div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          &#123;params.extra&#125;
        </span>{" "}
        is: {props.params.extra}
      </div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          URL
        </span>{" "}
        is: {props.url.toString()}
      </div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          URL Rewritten To
        </span>{" "}
        is: {props.rewrittenTo.url.toString()}
      </div>
      <div>
        <span className="rounded bg-gray-100 px-1.5 py-1 font-mono font-semibold text-black">
          URL Original
        </span>{" "}
        is: {props.original.url.toString()}
      </div>
    </div>
  );
}
