# Deployment Workflows Documentation

This directory contains GitHub Actions workflows for deploying the SmartCharts application to Cloudflare Pages.

## Overview

The deployment system consists of two main workflows and one reusable action:

- **`deploy-production.yml`** - Deploys to production on master branch pushes
- **`deploy-preview.yml`** - Creates preview deployments for pull requests
- **`../actions/build-and-deploy/action.yml`** - Reusable action for building and deploying

## Workflows

### Production Deployment (`deploy-production.yml`)

**Triggers:**
- Push to `master` branch (automatic)
- Manual trigger via GitHub UI (`workflow_dispatch`)

**Features:**
- Deploys to production Cloudflare Pages environment
- Uses concurrency control to prevent overlapping deployments
- Queues deployments when multiple are triggered simultaneously
- Uses repository secrets for credential management

**Environment Variables:**
- `FLUTTER_VERSION`: Flutter SDK version (default: 3.24.1)
- `FLUTTER_WEB_RENDERER`: Flutter web renderer (default: html)
- `NODE_VERSION`: Node.js version (default: 20.x)

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier

### Preview Deployment (`deploy-preview.yml`)

**Triggers:**
- Pull request events: `opened`, `synchronize`, `reopened`
- Triggers on PRs targeting any branch (`"**"`)

**Features:**
- Creates preview deployments for each PR
- Automatically cancels outdated deployments when new commits are pushed
- Generates safe branch slugs for Cloudflare Pages compatibility
- Handles complex branch names with special characters

**Branch Slug Generation:**
- Converts to lowercase
- Replaces `/` with `-`
- Removes special characters (keeps only alphanumeric, `_`, `-`)
- Limits to 63 characters (Cloudflare requirement)
- Falls back to `pr-{number}` if branch name is empty

**Required Secrets:**
- Same as production deployment

## Reusable Action (`../actions/build-and-deploy/action.yml`)

### Purpose
Handles the complete build and deployment process for both production and preview environments.

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `cloudflare_api_token` | ✅ | - | Cloudflare API Token |
| `cloudflare_account_id` | ✅ | - | Cloudflare Account ID |
| `project_name` | ✅ | - | Cloudflare Pages project name |
| `branch_name` | ✅ | - | Branch name for deployment |
| `node_version` | ❌ | 20.x | Node.js version |
| `flutter_version` | ❌ | 3.24.1 | Flutter version |
| `flutter_web_renderer` | ❌ | html | Flutter web renderer |
| `environment` | ❌ | preview | Deployment environment |

### Outputs

| Output | Description |
|--------|-------------|
| `deployment_url` | The URL of the deployed application |

### Process Steps

1. **Repository Checkout** - Fetches the complete repository
2. **Environment Setup** - Configures Node.js and Flutter
3. **Dependency Installation** - Installs npm packages
4. **Flutter Build** - Builds the Flutter chart component
5. **Application Build** - Builds the main application
6. **Build Validation** - Verifies build artifacts exist
7. **File Preparation** - Organizes files for deployment
8. **Wrangler Installation** - Installs latest Cloudflare Wrangler CLI
9. **Deployment** - Deploys to Cloudflare Pages with URL extraction

## Security Considerations

### Repository Secrets
Both workflows use repository-level secrets, allowing:
- Shared credentials between production and preview environments
- Centralized secret management
- No environment-specific secret duplication

### Permissions
Workflows use minimal required permissions:
- `contents: read` - Read repository content
- `deployments: write` - Create deployment records
- `pull-requests: write` - Update PR status (preview only)
- `statuses: write` - Update commit status (preview only)
- `actions: read` - Read workflow information

## Concurrency Control

### Production
- **Group:** `deploy-production`
- **Cancel in Progress:** `false` (queues deployments)
- **Behavior:** Ensures deployments run sequentially

### Preview
- **Group:** `deploy-preview-{pr-number}`
- **Cancel in Progress:** `true` (cancels outdated deployments)
- **Behavior:** Only latest commit deployment runs per PR

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js and Flutter versions match project requirements
   - Verify all dependencies are properly declared in package.json
   - Review build logs for specific error messages

2. **Deployment Failures**
   - Verify Cloudflare credentials are valid and have proper permissions
   - Check project name matches Cloudflare Pages project
   - Ensure account ID is correct

3. **Branch Slug Issues**
   - Branch names with special characters are automatically sanitized
   - Very long branch names are truncated to 63 characters
   - Empty or invalid branch names fall back to `pr-{number}`

### Debugging

Enable debug logging by adding this to workflow environment:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## Maintenance

### Updating Dependencies
- **Wrangler**: Automatically uses latest version
- **Actions**: Update version tags in workflow files
- **Flutter/Node**: Update version numbers in environment variables

### Monitoring
- Check GitHub Actions tab for workflow status
- Monitor Cloudflare Pages dashboard for deployment health
- Review deployment URLs in workflow outputs

## Best Practices

1. **Testing**: Always test changes in preview deployments before merging
2. **Secrets**: Rotate Cloudflare credentials periodically
3. **Monitoring**: Set up alerts for deployment failures
4. **Documentation**: Keep this documentation updated with changes
