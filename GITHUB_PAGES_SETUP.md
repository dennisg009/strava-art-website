# GitHub Pages Setup Instructions

## Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top menu)
3. Scroll down and click on **Pages** in the left sidebar
4. Under **Source**, select **GitHub Actions** (NOT "Deploy from a branch")
5. Click **Save**

## Step 2: Verify the Workflow Runs

1. Go to the **Actions** tab in your repository
2. You should see a workflow run starting (it will be triggered by the push or you can manually trigger it)
3. Wait for it to complete (should take 1-2 minutes)
4. Check that both the "build" and "deploy" jobs complete successfully (green checkmarks)

## Step 3: Access Your Site

Once the deployment completes, your site will be available at:
- **https://dennisg009.github.io/strava-art-website/**

## Troubleshooting

- If you see "404 - Site not found": GitHub Pages isn't enabled or the source isn't set to "GitHub Actions"
- If the workflow fails: Check the Actions tab for error messages
- If the site loads but shows a white screen: Check the browser console for errors


