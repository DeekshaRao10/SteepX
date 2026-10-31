const { compile } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");
const path = require("path");
const fs = require("fs");

async function buildCss() {
  const cssInput = fs.readFileSync(path.resolve(__dirname, "./src/app/globals.css"), "utf8");
  const compiler = await compile(cssInput, {
    from: path.resolve(__dirname, "./src/app/globals.css"),
    base: path.resolve(__dirname, "./src/app"),
    onDependency: () => {},
  });
  
  const scanner = new Scanner({
    sources: [{ base: path.resolve(__dirname, "./src"), pattern: "**/*", negated: false }],
  });
  const candidates = scanner.scan();
  const outputCss = compiler.build(candidates);

  fs.mkdirSync(path.resolve(__dirname, "./public"), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, "./public/compiled-tailwind.css"), outputCss, "utf8");
  fs.writeFileSync(path.resolve(__dirname, "./src/app/tailwind-built.css"), outputCss, "utf8");
  console.log(`[Tailwind Compiler] Built ${candidates.length} utility candidates (${outputCss.length} bytes) to public & src/app!`);
}

buildCss().catch((err) => {
  console.error("Failed to build Tailwind CSS:", err);
  process.exit(1);
});

