import OpenAIApi from "openai";
import simpleGit from "simple-git";
import fs from "fs";

const MODEL = "gpt-4";
export const MAXIMUM_TOKENS = 4096;
const CONTEXT_SIZE_MAXIMUM = 100;
const TOKEN = process.env.OPENAI_API_KEY;

export async function callGpt(system, prompt) {
  const openai = new OpenAIApi(TOKEN);
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    return completion.choices[0].message;
  } catch (error) {
    throw error;
  }
}

export async function getDiff(dirName) {
  const git = simpleGit(dirName);

  // Read new files (untracked files)
  const newFilesContent = await getNewFilesContent(git, dirName);

  // Find new files number of tokens
  const newFilesTokens = newFilesContent
    .map((newFileContent) => countStringTokens(newFileContent))
    .reduce((a, b) => a + b, 0);

  // Check if new files are too long
  if (newFilesTokens >= MAXIMUM_TOKENS) {
    throw new Error("New Files are too long. Please commit them first.");
  }

  const availableTokens = MAXIMUM_TOKENS - newFilesTokens;

  // Read diff
  const trackedDiff = await getTrackedDiff(git, availableTokens);

  const trackedDiffTokens = countStringTokens(trackedDiff);

  if (trackedDiffTokens + newFilesTokens >= MAXIMUM_TOKENS) {
    throw new Error("Diff is too long");
  }

  return trackedDiff + "\n" + newFilesContent.join("\n");
}

async function getNewFilesContent(git, dirName) {
  const newFiles = await getNewFiles(git);
  const newFilesAsList = newFiles
    .split("\n")
    .filter((newFile) => newFile.trim().length > 0)
    .filter((newFile) => shouldIncludeFile(newFile));

  const newFilesContent = [];
  for (const new_file of newFilesAsList) {
    const file_path = dirName + "/" + new_file;
    const content = fs.readFileSync(file_path, "utf8");
    newFilesContent.push(
      `New File ${new_file}\n---\n${content}\n---\nEnd of new file ${new_file}`
    );
  }
  return newFilesContent;
}

export async function getTrackedDiff(git, availableTokens) {
  let diff = "";
  for (
    let contextSize = 10;
    contextSize < CONTEXT_SIZE_MAXIMUM;
    contextSize += 20
  ) {
    diff = await git.diff(getDiffCommand(contextSize));

    if (diff.length == 0) {
      return "";
    }

    if (diff.length > availableTokens) {
      diff = await git.diff(getDiffCommand(0));
      if (diff.length > availableTokens) {
        throw new Error("Diff too long");
      }
      return diff;
    }

    if (diff.length > availableTokens * 0.8) {
      break;
    }
  }

  return diff;
}

async function getNewFiles(git) {
  return await git.raw(["ls-files", "--others", "--exclude-standard"]);
}

const countStringTokens = (string) => {
  return string.split(/\s+/).length;
};

const getDiffCommand = (contextSize) => {
  ["-U" + contextSize];
};

const shouldIncludeFile = (file) => {
  const fileExtension = file.split(".").pop();
  const excludedExtensions = ["png", "jpg", "jpeg", "gif", "ico", "svg", "lock", "webp"];
  return !excludedExtensions.includes(fileExtension);
}
