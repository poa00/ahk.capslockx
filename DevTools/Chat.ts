import clipboard from "clipboardy";
import "dotenv/config";
import { readFile } from "fs/promises";
import OpenAI from "openai";
import { createInterface } from "readline/promises";
import { ReadableStream, WritableStream } from "stream/web";

const apiKey = process.env.OPENAI_API_KEY;
const base = process.env.OPENAI_BASE ?? undefined;
const ai = new OpenAI({ apiKey, baseURL: base });
let ac = new AbortController();
console.log("chat loaded");
const context = `
// Context
`;

const codeCompletorPrompt = (input = "") => `
You are a typescript-react engineer.

Your skill stack included:
- Typescript ESNext standard, Functional programming, TailwindCSS.

Please complete my TODOs comments placed in my code,

I will send you the whole file contents with TODOs comments, and you shold reply your well styled code modifications segments near TODOs.

${"```typescript"}
${input}
${"```"}

And the Optimized typescript code is:

${"```typescript"}
`;
const reactTesterPrompt = (input = "") => `
You are a typescript-react engineer.

Your skill stack included:
- Typescript ESNext standard, Functional programming, TailwindCSS.

My react component:

${"```tsx"}
${input}
${"```"}

Please write a unit test for the component above, import everything you need from vitest, @testing-library/react, ...and so on.

Your answer should be pure typescript code, and the specification code should be:

${"```typescript"}
import { it, expect, describe, vi } from "vitest";
import userEvent from "@testing-library/user-event";
// go on...
`;

const anyToChineseTranslatorPrompt = (input = "") => `
You are a Chinese translator, you are translating any language article to Chinese.
Please give me Chinese transcript of every message sent to you,

${"```plaintext"}
${input}
${"```"}

${"```plaintext"}
`;

const anyToJapaneseTranslatorPrompt = (input = "") => `
You are a Japanese translator, you are translating any language article to Japanese.
Please give me Japanese transcript of every message sent to you,

${"```plaintext"}
${input}
${"```"}

${"```plaintext"}
`;

const anyToEnglishTranslatorPrompt = (input = "") => `
You are a English translator, you are translating any language article to English.
Please give me English transcript of every message sent to you,

${"```plaintext"}
${input}
${"```"}

${"```plaintext"}
`;

const clipFile = "./DevTools/clipboard.signal.log";
const clipOutFile = "./DevTools/clipboard-gpt.log";

const indicatorMapping = {
  "--en": anyToEnglishTranslatorPrompt,
  "--jp": anyToJapaneseTranslatorPrompt,
  "--react-test": reactTesterPrompt,
  "--zh": anyToChineseTranslatorPrompt,
  "--chat": (e = "") => e,
  "--code": codeCompletorPrompt,
};
main();

async function main() {
  await scanClipboardFile();
  // for await (const event of watch(clipFile)) {
  //   await onClipboardReceived();
  //   await new Promise((r) => setTimeout(r, 1000));
  // }

  // const { type } = await enquirer.prompt<{ type: string }>([
  //   {
  //     name: "type",
  //     message: "type",
  //     type: "select",
  //     choices: ["New", "Translate", "Code Complete"],
  //   },
  // ]);

  // const x = await enquirer.prompt<{ prompt: string }>([
  //   {
  //     name: "prompt",
  //     message: "prompt",
  //     type: "select",
  //     choices: ["New", "Translate", "code complete"],
  //   },
  // ]);
  // console.log(x.prompt);
  // //   const [promptCodeComplete] ()
  // console.log(x);
  // const prompt = "";

  // console.log('clipboard appended')
}

async function scanClipboardFile() {
  console.clear();

  const content =
    (await readFile(clipFile, "utf-8").catch(() => null)) ??
    (await clipboard.read().catch(() => null)) ??
    null;
  const [params, ...contents] = content
    .replace(/\r\n/g, "\n")
    .split("\n---\n\n");
  const input = contents.join("\n\n---\n\n");
  const question = indicatorMapping[params.trim()]?.(input) ?? input;
  console.log("Got question: \n", question);

  // todo: implement appendToClipboard(token) here
  let cp = "";
  async function appendToken(token: string) {
    if(!token )  return;
    cp += token;
    process.stdout.write(token);
    // await clipboard.write(cp).catch(() => null);
  }

  console.clear();
  await (
    await completion(question)
  ).pipeTo(new WritableStream({ write: (token) => appendToken(token) }));

  console.log("✅ clipboard written");
  process.stdout.write("\n");

  await clipboard.write(cp).catch(() => null);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await rl.question("Press any key to copy and exit...");
  await clipboard.write(cp).catch(() => null);
}
// async function onClipboardReceived() {
//   console.clear();

//   const content =
//     (await readFile(clipFile, "utf-8").catch(() => null)) ??
//     (await clipboard.read().catch(() => null)) ??
//     null;
//   const [params, ...contents] = content
//     .replace(/\r\n/g, "\n")
//     .split("\n---\n\n");
//   const prompt = indicatorMapping[params.trim()]?.(contents) ?? params.trim();j
//   const question = contents.join("\n\n---\n\n");
//   console.log("Got prompt: \n", prompt);
//   console.log("Got question: \n", question);
//   await completion(prompt, question);
// }
//
async function completion(content = "") {
  ac?.abort?.();
  ac = new AbortController();
  const signal = ac.signal;
  const r = await ai.chat.completions.create(
    {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are AI assistant." },
        { role: "user", content },
      ],
      stream: true,
    },
    { signal },
  );

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of r) {
        controller.enqueue(chunk.choices[0]?.delta?.content || "");
      }
    },
  });
}