const { compile } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");
const path = require("path");
const fs = require("fs");

async function buildCss() {
  const srcCssPath = path.resolve(__dirname, "./src/app/globals.src.css");
  const cssInput = fs.readFileSync(srcCssPath, "utf8");
  
  const compiler = await compile(cssInput, {
    from: srcCssPath,
    base: path.resolve(__dirname, "./src/app"),
    onDependency: () => {},
  });
  
  const scanner = new Scanner({
    sources: [{ base: path.resolve(__dirname, "./src"), pattern: "**/*", negated: false }],
  });
  const candidates = scanner.scan();
  const outputCss = compiler.build(candidates);

  // Write directly into globals.css and public
  fs.mkdirSync(path.resolve(__dirname, "./public"), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, "./public/compiled-tailwind.css"), outputCss, "utf8");
  fs.writeFileSync(path.resolve(__dirname, "./src/app/globals.css"), outputCss, "utf8");
  
  console.log(`[Tailwind Compiler] Successfully compiled ${candidates.length} candidates (${outputCss.length} bytes) into globals.css!`);
}

buildCss().catch((err) => {
  console.error("Failed to build Tailwind CSS:", err);
  process.exit(1);
});
