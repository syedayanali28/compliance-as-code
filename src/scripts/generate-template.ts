import path from "path";
import { generateTemplate } from "../lib/excel/template-generator";

const outputPath = path.resolve(
  import.meta.dirname ?? ".",
  "../public/templates/idac-template.xlsx"
);

generateTemplate(outputPath)
  .then((p: string) => console.log(`Template generated: ${p}`))
  .catch((err: unknown) => {
    console.error("Failed to generate template:", err);
    process.exit(1);
  });
