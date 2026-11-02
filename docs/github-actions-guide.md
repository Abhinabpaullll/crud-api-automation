# GitHub repository and Actions guide

No remote is currently configured in this checkout, so no hosted GitHub Actions run has been inspected. These steps explain how to publish the existing `main` branch and inspect CI after you create the repository.

## Create the repository and push

1. Sign in to GitHub and select **New repository**.
2. Choose a repository name, set visibility, and create it without adding an initial README (the local project already has its own files).
3. From PowerShell in the project directory, add the remote and push:

```powershell
git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the two placeholders with the account and repository name. Do not put credentials or tokens in the remote URL.

Alternatively, if GitHub CLI is authenticated:

```powershell
gh repo create YOUR-REPOSITORY --private --source=. --remote=origin --push
```

## Inspect a successful run

1. Open the repository page in GitHub.
2. Select **Actions**.
3. Open the latest **API tests** workflow run.
4. Expand the `npm run test:all` step. A passing run has a green check and Newman summary tables with zero failures.
5. Open the workflow run’s **Artifacts** area and download `api-reports` to inspect HTML and JUnit files.

## Inspect a failed run

1. In **Actions**, open the run with a red cross.
2. Select the failed job and expand the first failed step, usually health readiness or Newman.
3. Read Newman’s failure table for request name, assertion, expected value, and actual value.
4. Download the `api-reports` artifact if it was produced; the upload step uses `if: always()`.
5. Fix the underlying code or test setup, rerun locally with `npm run test:all`, then commit and push the correction.

The workflow uses no project secrets. It starts an in-memory backend and enables test-only reset routes only for this isolated test job.
