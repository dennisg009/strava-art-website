# GitHub Pages Deployment Guide

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right and select "New repository"
3. Name it `strava-art-website` (or any name you prefer)
4. **Do NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Push Your Code to GitHub

Run these commands in your terminal (from the project directory):

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/strava-art-website.git

# Push to GitHub
git push -u origin main
```

If your repository is named something other than `strava-art-website`, update the remote URL accordingly.

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on "Settings" (top menu)
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select:
   - **Source**: `GitHub Actions`
5. The page will automatically deploy when you push to the `main` branch

## Step 4: Update Base Path (if needed)

If your repository name is NOT `strava-art-website`, you need to update the base path in `vite.config.js`:

1. Open `vite.config.js`
2. Change the `base` property to match your repository name:
   ```javascript
   base: '/YOUR_REPOSITORY_NAME/',
   ```
3. Commit and push the change:
   ```bash
   git add vite.config.js
   git commit -m "Update base path for GitHub Pages"
   git push
   ```

**Note**: If your repository is named `username.github.io`, you should use `base: '/'` instead.

## Step 5: Access Your Site

Once the GitHub Actions workflow completes (usually takes 1-2 minutes), your site will be available at:

- `https://YOUR_USERNAME.github.io/strava-art-website/`

(Replace `YOUR_USERNAME` with your GitHub username and `strava-art-website` with your repository name)

## Troubleshooting

- **404 Error**: Make sure the base path in `vite.config.js` matches your repository name
- **Build Fails**: Check the "Actions" tab in your GitHub repository for error messages
- **Site not updating**: Wait a few minutes for GitHub Pages to rebuild after pushing changes

