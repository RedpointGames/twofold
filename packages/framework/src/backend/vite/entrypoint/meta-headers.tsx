export function MetaHeaders(props: {
  telemetryTraceMetaHeaders: { [name: string]: string };
}) {
  let metaHeaders = [];
  for (const name of Object.getOwnPropertyNames(
    props.telemetryTraceMetaHeaders,
  )) {
    metaHeaders.push(
      <meta
        key={name}
        name={name}
        content={props.telemetryTraceMetaHeaders[name]}
        x-is-telemetry-header="true"
      />,
    );
  }
  return metaHeaders;
}
