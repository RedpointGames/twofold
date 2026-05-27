// This is undesirable, but we need to figure out the action ID for auth checks and React only exposes `decodeAction` which returns the function itself.

export function decodeActionId(body: FormData): string | null {
  let actionId: string | null = null;
  const seenActions = new Set<string>();

  // $FlowFixMe[prop-missing]
  body.forEach((_: string | File, key: string) => {
    // Later actions may override earlier actions if a button is used to
    // override the default form action. However, we don't expect the same
    // action ref field to be sent multiple times in legitimate form data.
    if (key.startsWith("$ACTION_REF_")) {
      if (seenActions.has(key)) {
        return;
      }
      seenActions.add(key);
      // @hack: We know this is the field based on the internals of decodeBoundActionMetaData. Hopefully React will add a better API in the future.
      const idAndBoundJson = body.get("$ACTION_" + key.slice(12) + ":0");
      if (idAndBoundJson !== null && typeof idAndBoundJson === "string") {
        const cleaner = (key: string, value: any) => {
          return (key === "id" && typeof value === "string") ||
            (key === "" &&
              typeof value === "object" &&
              Object.getOwnPropertyNames(value).length === 1 &&
              "id" in value &&
              typeof value["id"] === "string")
            ? value
            : undefined;
        };
        const idContainer = JSON.parse(idAndBoundJson, cleaner) as unknown;
        if (
          idContainer !== undefined &&
          idContainer !== null &&
          typeof idContainer === "object" &&
          "id" in idContainer &&
          idContainer["id"] !== undefined &&
          idContainer["id"] !== null &&
          typeof idContainer["id"] === "string"
        ) {
          actionId = idContainer["id"];
          return;
        }
      }
    }
    // A simple action with no bound arguments may appear twice in the form data
    // if a button specifies the same action as the default form action. We only
    // load the first one, as they're guaranteed to be identical.
    if (key.startsWith("$ACTION_ID_")) {
      if (seenActions.has(key)) {
        return;
      }
      seenActions.add(key);
      actionId = key.slice(11);
      return;
    }
  });

  if (
    typeof actionId === "string" &&
    actionId !== undefined &&
    actionId !== null
  ) {
    return actionId;
  } else {
    return null;
  }
}
