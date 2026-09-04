
const fs = require("fs");
let content = fs.readFileSync("src/store/chatStore.ts", "utf8");

content = content.replace(/sender: "agent",/g, `sender: "agent" as const,`);
content = content.replace(/currentUser,/g, `currentUser: currentUser || undefined,`);
content = content.replace(/\} \);/g, `} as any);`); 
// careful with nativeForm.append
content = content.replace(/type: asset.mimeType \|\| "application\/octet-stream",\s*\}\);/g, `type: asset.mimeType || "application/octet-stream",\n        } as any);`);
content = content.replace(/new Promise\(\(resolve, reject\)/g, `new Promise<{ status: number; body: string }>((resolve, reject)`);
content = content.replace(/let uploadData = \{\};/g, `let uploadData: Record<string, unknown> = {};`);
content = content.replace(/JSON.parse\(uploadResult.body\);/g, `JSON.parse(uploadResult.body) as Record<string, unknown>;`);
content = content.replace(/const nested = uploadData\?\.data;/g, `const nested = uploadData?.data as Record<string, unknown> | undefined;`);
content = content.replace(/let fileData = asset.file;/g, `let fileData: any = (asset as any).file;`);
content = content.replace(/sendLocation:/g, `sendLocationMessage:`);

fs.writeFileSync("src/store/chatStore.ts", content, "utf8");

let indexContent = fs.readFileSync("app/(tabs)/chats/index.tsx", "utf8");
indexContent = indexContent.replace(/sendLocation\(/g, `sendLocationMessage(`); // if any
fs.writeFileSync("app/(tabs)/chats/index.tsx", indexContent, "utf8");

console.log("Done");

