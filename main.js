import { callGpt, getDiff, MAXIMUM_TOKENS } from "./helpers.js";

console.log("Running amgosh...");

const SYSTEM = `You are an assistent named Amgosh.
Your pupose is to read git diff and find possible issues.
You list the issues in bullet points.
Each issue should start with sevirity level.
Sevirity levels are: Critical, High, Medium, Low.
Sevirity levels are bolded by **.
The order of the issues should be from most important to least important.
For example:
---
  - *Critical*: In function "get" for class "User" parameter, there is a type when referencing "name". You wrote "nmae" instead of "name". this can result in a bug.
  - *High*: Function "get" does not return anything.
  - *Medium*: Parameter "name" passed to function "get" is not used.
  - *Low*: In function "
---
You dont add any information but the bullet points.
You dont make any comments regarding tests, documentation and format unless it affects the app.`

await main();

async function main() {
  var args = process.argv.slice(2);

  if (args.length == 0) {
    console.log("Please a dir name");
    return;
  }

  var dirName = args[0];


  const diff = await getDiff(dirName);

  if (diff.length == 0) {
    console.log("No changes");
    return;
  }

  const tokensInDiff = diff.trim().split(/\s+/).length;

  if (tokensInDiff > MAXIMUM_TOKENS) {
    console.log("Diff too long");
    return;
  }

  callGpt(SYSTEM, diff).then((response) => {
    console.log(response.content);
  });
}
