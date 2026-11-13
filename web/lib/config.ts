// Site settings: the contract address, the name and the lines it is introduced with, and the repository.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset. It is filled in
// once the contract is deployed; while both are empty every page says the contract is not deployed yet,
// and the whole site still works with NEXT_PUBLIC_MOCK=1.
export const DEMO_CONTRACT: string = "0x428CC86a2ea976769e218Fc2915E2E54294cA1Be";

export const SITE_NAME = "Found It";
export const SITE_TAGLINE = "The reward goes only to whoever can describe what is inside.";
export const SITE_LINE =
  "A lost-property reward that pays only the real finder: the owner seals the item's hidden marks, a finder describes them, and GenLayer's validators decide whether the description matches before the reward moves.";

/**
 * The public source repository. NEXT_PUBLIC_REPO_URL names it; on Vercel the repository the site was
 * built from names it by itself. The footer's Source link is hidden while neither names one.
 */
const builtFrom =
  process.env.NEXT_PUBLIC_VERCEL_GIT_PROVIDER === "github" && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER}/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG}`
    : "";
export const REPO_URL: string = process.env.NEXT_PUBLIC_REPO_URL || builtFrom || "";

/** The contract in use: the deploy's environment first, then the committed address. */
export const contractAddress = (): string => process.env.NEXT_PUBLIC_CONTRACT || DEMO_CONTRACT || "";
