import path from "path";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

const GITHUB_API = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";
const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".md"]);

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "package.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

function getHeaders() {
  const headers = { Accept: "application/vnd.github.v3+json" };
  if (env.githubToken) {
    headers["Authorization"] = `Bearer ${env.githubToken}`;
  }
  return headers;
}

/**
 * Returns all file paths in the repo that match the allowed extensions.
 * Uses the Git Trees API (recursive) — one request for the full file list.
 */
export async function fetchRepoFiles(
  repo = env.githubRepo,
  branch = env.githubBranch
) {
  if (!repo) throw new AppError("GITHUB_REPO is not set in environment", 500);

  // 1. Get the branch's HEAD commit tree SHA
  const branchRes = await fetch(`${GITHUB_API}/repos/${repo}/branches/${branch}`, {
    headers: getHeaders()
  });

  if (!branchRes.ok) {
    const err = await branchRes.json().catch(() => ({}));
    throw new AppError(
      `GitHub API error fetching branch: ${err.message || branchRes.status}`,
      branchRes.status
    );
  }

  const branchData = await branchRes.json();
  const treeSha = branchData?.commit?.commit?.tree?.sha;

  if (!treeSha) throw new AppError("Could not resolve tree SHA from branch", 500);

  // 2. Fetch the full recursive tree (all paths in one request)
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${repo}/git/trees/${treeSha}?recursive=1`,
    { headers: getHeaders() }
  );

  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    throw new AppError(
      `GitHub API error fetching tree: ${err.message || treeRes.status}`,
      treeRes.status
    );
  }

  const treeData = await treeRes.json();

  if (treeData.truncated) {
    console.warn("GitHub tree response was truncated — very large repo. Some files may be skipped.");
  }

  // 3. Filter to allowed file extensions only (node_modules is gitignored so won't appear)
  return treeData.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        ALLOWED_EXTENSIONS.has(path.extname(item.path)) &&
        !EXCLUDED_FILES.has(path.basename(item.path))
    )
    .map((item) => item.path);
}

/**
 * Fetches raw text content of a single file from GitHub.
 */
export async function fetchFileContent(
  filePath,
  repo = env.githubRepo,
  branch = env.githubBranch
) {
  const url = `${RAW_BASE}/${repo}/${branch}/${filePath}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    console.warn(`Could not fetch ${filePath} (${res.status}) — skipping`);
    return null;
  }

  return res.text();
}

export async function fetchCommits(
  repo = env.githubRepo,
  branch = env.githubBranch,
  perPage = 100
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/commits?sha=${branch}&per_page=${perPage}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new AppError(
      `GitHub API error fetching commits: ${err.message || res.status}`,
      res.status
    );
  }

  const data = await res.json();

  return data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    author: c.commit.author.name,
    date: c.commit.author.date
  }));
}