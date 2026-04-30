import { Config } from "@twofold/framework/types";

let config: Config = {
  experimental_viteConfig: {
    build: {
      build: {
        // turn on sourcemaps to ensure that experimental_viteConfig works
        sourcemap: "hidden",
      },
      plugins: [
        {
          name: `kitchen-sink:test-plugin`,
          async buildApp() {
            console.log("kitchen-sink:test-plugin got buildApp event");
          },
        },
      ],
    },
  },
};

export default config;
