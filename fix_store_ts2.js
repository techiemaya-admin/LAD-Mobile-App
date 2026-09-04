
const fs = require("fs");
let content = fs.readFileSync("src/store/chatStore.ts", "utf8");

content = content.replace(/status: "sending",/g, `status: "sending" as const,`);
content = content.replace(/currentUser: currentUser \|\| undefined,/g, `currentUser: (currentUser as any) || undefined,`);

fs.writeFileSync("src/store/chatStore.ts", content, "utf8");

console.log("Done");

