import { deny } from "@twofold/framework/auth";

export const auth = [
  () => {
    return deny("no access");
  },
];
