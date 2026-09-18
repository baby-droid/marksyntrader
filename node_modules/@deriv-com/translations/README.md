# `@deriv-com/translations`

This is a localization library that uses `i18next`, `react-i18next`, and a custom OTA SDK for translations.

**In this document**

- [Overview](#overview)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
    - [`initializeI18n`](#initializei18n)
    - [`<Localize />`](#localize-component-example)
    - [`localize`](#localize-example)
    - [`useTranslations` Hook](#usetranslations-hook)
- [Syncing translations to CDN](#syncing-translations)
    - [Example usage of the action in the workflow file](#example-usage-of-the-action-in-the-workflow-file)
- [Contributing](#contributing)

## Overview

![image](https://github.com/amir-deriv/translations/assets/129206554/e303f0cb-e15f-41e9-92ad-f930e43c484b)


## Requirements

The stored translation directory must have the following structure:
`{{ BASE_URL }}/translations/{lang}.json`

base_url is the cdnUrl passed to the `initializeI18n` function, and lang is the language code. Refer to the [example](#initializei18n)

## Getting Started

To get started, one would need few things to setup first which are:
1. A Crowdin project which will be used to manage translations for your project.
2. A Cloudflare R2 account to store the translations.
    - Create a new bucket in the R2 account.
    - Create a new access key in the R2 account.
3. Add the following secrets to your repository:
    - `CROWDIN_PROJECT_ID`: Open your crowdin project and navigate to `Tools` tab, you will be able to get the Project ID, store that in your github secrets.
    - `CROWDIN_PERSONAL_TOKEN`: This can be obtained by logging in to your crowdin account and clicking on your profile icon and goto `Settings > API` and create a new personal access token, store that in your github secrets.
    - `R2_ACCOUNT_ID`: R2 account ID from the Cloudflare R2 dashboard.
    - `R2_ACCESS_KEY_ID`: R2 access key ID from the Cloudflare R2 dashboard.
    - `R2_SECRET_ACCESS_KEY`: R2 secret access key from the Cloudflare R2 dashboard.
    - `R2_BUCKET_NAME`: R2 bucket name from the Cloudflare R2 dashboard.
4. Add the following environment variable in your repository:
    - `PROJECT_NAME`: Add project name in your environment variable which will be used for Cloudflare R2 folder name for translations.
    - `CROWDIN_BRANCH_NAME`: Add the branch name for your crowdin project to separate the translations based on environment, this needs to be put into the environment variable instead of secret because the consumer of the package needs it while defining the `cdnUrl` to access the translations.
5. Setup the github action to sync the translations to the CDN, refer to the [Syncing translations](#syncing-translations) section for more details.

Install the package by running:

```bash
npm install @deriv-com/translations
```

### Setup

- initialize translations in main component by importing and calling `initializeI18n` outside of the component function.
- pass the return value to the `TranslationProvider` component from `@deriv-com/translations`.
- pass default language to the `TranslationProvider` component.

```jsx
    import { initializeI18n, TranslationProvider } from '@deriv-com/translations';
    ...
    const i18nInstance = initializeI18n({ cdnUrl: 'https://cdn.example.com' })

    const App = () => {
        ...
        return (
            <TranslationProvider defaultLang={'EN'} i18nInstance={i18nInstance}>
                <App />
            </TranslationProvider>
        )
    }

```

## Usage

### `initializeI18n`

The `initializeI18n` function initializes the `i18next` instance with the OTA SDK, `react-i18next`, and a language detector. It takes an object with a cdnUrl property, which is the URL of the CDN where the translations are stored.

```javascript
import initializeI18n from "@deriv-com/translations";

initializeI18n({ cdnUrl: "https://cdn.example.com" });
```

- For strings use either `localize(...)` or `<Localize />`.

### `Localize` component example:

```jsx
import { Localize } from "@deriv-com/translations";

<Localize
  i18n_default_text="You cannot use your real money account with {{website_name}} at this time."
  values={{ website_name }}
/>;
```

### `localize` example:

> Note that the `localize` function will not get the update from i18n instance once there is any changes like resource loaded or language change. This `localize` function is not to be used to wrap strings in components and only suitable for util/mapper functions which would not cause issues with string not getting updated.

```jsx
import { localize } from "@deriv-com/translations";

const getNotification = () => ({
  all: localize("all notifications"),
});
```

### `useTranslations` Hook

The useTranslations hook is a custom hook that adds some more returned values on top of the `useTranslation` hook from `react-i18next`. It can be used to translate strings in your components, toggle the language of the app and see the current language etc.

Example usage:

```javascript
import { useTranslations } from "@deriv-com/translations";

const MyComponent = () => {
  const { localize, switchLanguage, currentLang } = useTranslations();

  const handleLanguageChange = () => {
    switchLanguage(currentLang === "EN" ? "DE" : "EN");
  };

  return <p onClick={handleLanguageChange}>{localize("Change language")}</p>;
};
```

## Syncing translations

There is a github action that syncs the translations from Crowdin to the CDN.

The action takes following inputs:

- `PROJECT_SOURCE_DIRECTORY`: Source directory of your project by default it is `src`.
- `CROWDIN_BASE_PATH`: Base path of the translations in the Crowdin project by default it is `.`.
- `CROWDIN_BASE_URL`: Base URL of the CDN where the translations are stored, default is `https://api.crowdin.com`.
- `CROWDIN_BRANCH_NAME`: Running on production, test or staging etc.
- `CROWDIN_PROJECT_ID`: Crowdin project ID which can be found in the crowdin project settings.
- `CROWDIN_PERSONAL_TOKEN`: Crowdin personal token which can be found in the crowdin account settings.
- `R2_ACCOUNT_ID`: R2 account ID from the Cloudflare R2 dashboard.
- `R2_ACCESS_KEY_ID`: R2 access key ID from the Cloudflare R2 dashboard.
- `R2_SECRET_ACCESS_KEY`: R2 secret access key from the Cloudflare R2 dashboard.
- `R2_BUCKET_NAME`: R2 bucket name from the Cloudflare R2 dashboard.

Refer to the action file [here](https://github.com/deriv-com/translations/blob/main/.github/actions/extract_and_sync_translations/action.yml).

### Example usage of the action in the workflow file:

Copy and paste the following workflow code in your repository in this path`.github/workflows/sync_translations.yml`.

```yaml
name: Sync translations

on:
  push:
    branches:
      - 'main'
  schedule:
    - cron: '0 */12 * * *'

jobs:
  sync_translations:
    runs-on: ubuntu-latest
    steps:
      - name: Sync translations
        uses: deriv-com/translations/.github/actions/extract_and_sync_translations@main
        with:
          PROJECT_NAME: ${{ env.PROJECT_NAME }}
          CROWDIN_BRANCH_NAME: ${{ env.CROWDIN_BRANCH_NAME }}
          CROWDIN_BASE_URL: ${{ env.CROWDIN_BASE_URL }}
          CROWDIN_BASE_PATH: ${{ env.CROWDIN_BASE_PATH }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
```

## Contributing

Contributions are welcome. Please open a pull request with your changes.
