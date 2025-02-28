---
title: 'GitHub Actions Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with GitHub Actions and Nx
---

# GitHub Actions with Nx

In this tutorial we're going to learn how to leverage Nx to setup a scalable CI pipeline on GitHub Actions. You're going to learn

- how to set up GitHub Actions and configure Nx
- how to run tasks for only the projects that were affected by a given PR
- how to enable remote caching
- how to parallelize and distribute tasks across multiple machines

Note, many of these optimizations are incremental, meaning you could set up running tasks for only affected projects and stop there. Later when you experience slow CI runs, you could add caching to further improve CI performance or even go further and distribute tasks across machines.

## Example Repository

To follow along with this tutorial, we recommend using the [nx-shops sample repository](https://github.com/nrwl/nx-shops).

{% github-repository url="https://github.com/nrwl/nx-shops" /%}

The `nx-shops` repo is useful to demonstrate the value of the CI pipeline because it has the following characteristics:

- Multiple Nx projects with interdependencies
- Defined lint, test, build and e2e tasks
- Running all the tasks takes more than a minute to finish

To get started:

1. [Fork the nx-shop repo](https://github.com/nrwl/nx-shops/fork) and then clone it to your local machine

   ```shell
   git clone git@github.com:<your-username>/nx-shops.git
   ```

2. Install dependencies (this repo uses [PNPM](https://pnpm.io/) but you should be able to also use any other package manager)

   ```shell
   pnpm i
   ```

3. Explore the structure of the repo using **the Nx Graph**

   ```shell
   pnpm nx graph
   ```

4. Finally, make sure all task are working on your machine, by running lint, test, build and e2e on all projects of the workspace

   ```shell
   pnpm nx run-many -t lint,test,build,e2e
   ```

## Set-up GitHub Actions

To get started with GitHub Actions, we'll create a pipeline that just logs a message. First, checkout a new branch:

```shell
git checkout -b ci-message
```

Then create (or modify) the `.github/workflows/ci.yml` file with these contents:

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI
on:
  push:
    branches:
      # Change this if your primary branch is not main
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Hello GitHub Actions!"
```

Next, commit this change, push the branch and create a PR on your forked GitHub repository:

```shell
git commit -am "pipeline that logs a message"
git push -u origin HEAD
```

If everything was set up correctly, you should see a message from GitHub Actions in the PR with a success status.

![All checks have passed in the PR](/nx-cloud/tutorial/gh-pr-passed.png)

Click on the job details and you should see the `Hello GitHub Actions` message in the logs.

![The "Hello GitHub Actions" message is printed in the logs](/nx-cloud/tutorial/gh-message.png)

Merge your PR into the `main` branch when you're ready to move to the next section.

## Configure Nx on GitHub Actions

Now let's use Nx in the pipeline. The simplest way to use Nx is to run a single task, so we'll start by building our `cart` application.

```shell
pnpm nx build cart
```

We need to adjust a couple of things on our CI pipeline to make this work:

- clone the repository
- install NPM dependencies (in our nx-shop using PNPM)
- use Nx to run the `build` command

Nx is an [npm package](https://www.npmjs.com/package/nx) so once NPM packages are installed we will be able to use it.

Create a new branch called `build-one-app` and paste this code into the GitHub Actions config.

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=["12-20"] %}
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # Setup pnpm
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx build cart
```

Once `node_modules` are in place, you can run normal Nx commands. In this case, we run `pnpm nx build cart`. Push the changes to your repository by creating a new PR and verifying the new CI pipeline correctly builds our application.

![Building a single app with nx](/nx-cloud/tutorial/gh-single-build-success.png)

You might have noticed that there's also a build running for `shared-header`, `shared-product-types` and `shared-product-ui`. These are projects in our workspace that `cart` depends on. Thanks to the [Nx task pipeline](/concepts/task-pipeline-configuration), Nx knows that it needs to build these projects first before building `cart`. This already helps us simplify our pipeline as we

- don't need to define these builds automatically
- don't need to make any changes to our pipeline as our `cart` app grows and depends on more projects
- don't need to worry about the order of the builds

Merge your PR into the `main` branch when you're ready to move to the next section.

## Optimize our CI by caching NPM dependencies

While this isn't related to Nx specifically, it's a good idea to cache NPM dependencies in CI. This will speed up the CI pipeline by avoiding downloading the same dependencies over and over again. GitHub Actions has [an action to cache files](https://github.com/actions/cache) that we'll use.

Adjust your CI pipeline script as follows

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=["18-24", "26-32"] %}
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - name: Restore cached npm dependencies
        uses: actions/cache/restore@v3
        with:
          path: |
            node_modules
            ~/.cache/Cypress # needed for the Cypress binary
          key: npm-dependencies-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm install --frozen-lockfile
      - name: Cache npm dependencies
        uses: actions/cache/save@v3
        with:
          path: |
            node_modules
            ~/.cache/Cypress # needed for the Cypress binary
          key: npm-dependencies-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm nx build cart
```

The `restore_cache` and `save_cache` steps are using a hash key that is created from the contents of the `pnpm-lock.yaml` file. This way if the `pnpm-lock.yaml` file remains the same, the next CI pipeline can pull from the cache instead of downloading `node_modules` again. This is similar to the way [Nx hashes input files to cache the results of tasks](/core-features/cache-task-results).

Create a new branch with these changes and submit a PR to your repo to test them. Merge your PR into the `main` branch when you're ready to move to the next section.

## Process Only Affected Projects

So far we only ran the build for our `cart` application. There are other apps in our monorepo workspace though, namely `admin`, `landing-page` and `products`. We could now adjust our CI pipeline to add these builds as well:

```plaintext
pnpm nx build cart
pnpm nx build admin
pnpm nx build landing-page
```

Clearly this is not a scalable solution as it requires us to manually add every new app to the pipeline (and it doesn't include other tasks like `lint`, `test` etc). To improve this we can change the command to run the `build` for all projects like

```{% command="nx run-many -t build" %}
    ✔  nx run shared-product-types:build (429ms)
    ✔  nx run shared-product-ui:build (455ms)
    ✔  nx run shared-header:build (467ms)
    ✔  nx run landing-page:build:production (3s)
    ✔  nx run admin:build:production (3s)
    ✔  nx run cart:build:production (3s)

 ————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 6 projects (10s)
```

This change makes our CI pipeline configuration more maintainable. For a small repository, this might be good enough, but after a little bit of growth this approach will cause your CI times to become unmanageable.

Nx comes with a dedicated ["affected" command](/ci/features/affected) to help with that by only running tasks for projects that were affected by the changes in a given PR.

```{% command="nx affected -t build" %}
    ✔  nx run shared-product-types:build (404ms)
    ✔  nx run shared-product-ui:build (445ms)
    ✔  nx run shared-header:build (465ms)
    ✔  nx run cart:build:production (3s)

 ——————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project cart and 3 tasks it depends on (4s)
```

### Configuring the Comparison Range for Affected Commands

To understand which projects are affected, Nx uses the Git history and the [project graph](/core-features/explore-graph). Git knows which files changed, and the Nx project graph knows which projects those files belong to.

The affected command takes a `base` and `head` commit. The default `base` is your `main` branch and the default `head` is your current file system. This is generally what you want when developing locally, but in CI, you need to customize these values.

The goal of the CI pipeline is to make sure that the current state of the repository is a good one. To ensure this, we want to verify all the changes **since the last successful CI run** - not just since the last commit on `main`.

While you could calculate this yourself, we created the [`nx-set-shas` GitHub Action](https://github.com/marketplace/actions/nx-set-shas) to help with that. It provides you with the `nrwl/nx-set-shas` action which automatically sets the `NX_BASE` and `NX_HEAD` environment variables to the correct commit SHAs. The affected command will use these environment variables when they are defined.

### Using the Affected Commands in our Pipeline

Let's adjust our CI pipeline configuration to use the affected command. Create a new branch called `ci-affected` and create a PR with the following configuration:

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=["35-39"] %}
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - name: Restore cached npm dependencies
        id: cache-dependencies-restore
        uses: actions/cache/restore@v3
        with:
          path: |
            node_modules
            ~/.cache/Cypress # needed for the Cypress binary
          key: npm-dependencies-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm install --frozen-lockfile
      - name: Cache npm dependencies
        id: cache-dependencies-save
        uses: actions/cache/save@v3
        with:
          path: |
            node_modules
            ~/.cache/Cypress # needed for the Cypress binary
          key: ${{ steps.cache-dependencies-restore.outputs.cache-primary-key }}
      - uses: nrwl/nx-set-shas@v3
      # This line is needed for nx affected to work when CI is running on a PR
      - run: git branch --track main origin/main
      - run: pnpm nx affected -t lint,test,build --parallel=3 --configuration=ci
      - run: pnpm nx affected -t e2e --parallel=1
```

We're using the `--parallel` flag to run up to 3 `lint`, `test` or `build` tasks at once, but we want to make sure that only 1 `e2e` task is running at a time.

When you check the CI logs for this PR, you'll notice that no tasks were run by the `affected` command. That's because the `.github/workflows/ci.yml` file is not an input for any task. We should really double check every task whenever we make changes to the CI pipeline, so let's fix that by adding an entry in the `sharedGlobals` array in the `nx.json` file.

```jsonc {% fileName="nx.json" highlightLines=[6] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [
      "{workspaceRoot}/babel.config.json",
      "{workspaceRoot}/.github/workflows/ci.yml" // add this line
    ]
    // etc...
  }
}
```

Merge your PR into the `main` branch when you're ready to move to the next section.

## Enable Remote Caching on GitHub Actions

Reducing the number of tasks to run via [affected commands](/ci/features/affected) (as seen in the previous section) is helpful, but might not be enough. By default [Nx caches the results of tasks](/core-features/cache-task-results) on your local machine. But CI and local developer machines are still performing the same tasks on the same code - wasting time and money. The [Nx Cloud remote cache](/ci/features/remote-cache) can eliminate that waste for you.

```{% command="pnpm nx connect" %}
✔ Enable distributed caching to make your CI faster · Yes

 >  NX   Distributed caching via Nx Cloud has been enabled

   In addition to the caching, Nx Cloud provides config-free distributed execution,
   UI for viewing complex runs and GitHub integration. Learn more at https://nx.app

   Your workspace is currently unclaimed. Run details from unclaimed workspaces can be viewed on cloud.nx.app by anyone
   with the link. Claim your workspace at the following link to restrict access.

   https://cloud.nx.app/orgs/workspace-setup?accessToken=[YourAccessTokenHere]
```

Click the link in the terminal to claim your workspace on [nx.app](https://nx.app). Once your workspace is successfully connected you should see an empty dashboard.

![Empty Nx Cloud Dashboard](/nx-cloud/tutorial/nx-cloud-empty-workspace.png)

Once your workspace is connected to Nx Cloud, run some tasks locally to prime the cache:

```shell
pnpm nx run-many -t lint,test,build,e2e
```

Now let's commit the changes to a new `ci-caching` branch and create a PR. The only change to the source code is adding an `nxCloudAccessToken` property to `nx.json`.

```json {% fileName="nx.json" %}
{
  ...
  "nxCloudAccessToken": "MWM4NTU..."
}
```

When GitHub Actions now processes our tasks they'll only take a fraction of the usual time. If you inspect the logs a little closer you'll see a note saying `[remote cache]`, indicating that the output has been pulled from the remote cache rather than running it. The full log of each command will still be printed since Nx restores that from the cache as well.

![GitHub Actions after enabling remote caching](/nx-cloud/tutorial/gh-ci-remote-cache.png)

The commands could be restored from the remote cache because we had run them locally before pushing the changes, thus priming the cache with the results. You can **configure** whether local runs should be read-only or read/write. [Our docs page has more details on security settings for your remote cache](/ci/concepts/cache-security).

You might also want to learn more about [how to fine-tune caching](/recipes/running-tasks/customizing-inputs) to get even better results.

Merge your PR into the `main` branch when you're ready to move to the next section.

## Enable PR Integration

The [Nx Cloud GitHub App](https://github.com/marketplace/official-nx-cloud-app) automatically creates a comment on your PRs that provides a direct link to the relevant Nx Cloud logs and quickly shows which command failed.

### Install the App

Install the [Nx Cloud GitHub App](https://github.com/marketplace/official-nx-cloud-app) and give it permission to access your repo.

### Connecting Your Workspace

Once you have installed the Nx Cloud GitHub App, you must link your workspace to the installation. To do this, sign in to Nx Cloud and navigate to the VCS Integrations setup page. Once on the VCS Integrations setup page, choose GitHub as your version control system.

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

### Authenticate Via the GitHub App

To use the Nx Cloud GitHub App for authentication, select the radio button and then click "Connect".
This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved.

![Use GitHub App for Authentication](/nx-cloud/set-up/use-github-app-auth.webp)

Now any new PRs in your repo should have a comment automatically added that links directly to Nx Cloud. For other ways of setting up PR integration, read the [Enable GitHub PR Integration recipe](/ci/recipes/source-control-integration/github).

## Parallelize Tasks across Multiple Machines

The affected command and remote caching help speed up the average CI time, but there will be some PRs that affect everything in the repository. The only way to speed up that worst case scenario is through efficient parallelization. The best way to parallelize CI with Nx is to use [distributed task execution (DTE)](/ci/features/distribute-task-execution).

Nx Cloud's DTE feature

- takes a command (e.g. `run-many -t build,lint,test,e2e`) and splits it into individual tasks which it then distributes across multiple agents
- distributes tasks by considering the dependencies between them; e.g. if `e2e` depends on `build`, Nx Cloud will make sure that `build` is executed before `e2e`; it does this across machines
- distributes tasks to optimize for CPU processing time and reduce idle time by taking into account historical data about how long each task takes to run
- collects the results and logs of all the tasks and presents them in a single view
- automatically shuts down agents when they are no longer needed

Let's enable DTE in our CI pipeline configuration. We'll use two reusable workflows from the `nrwl/ci` repository. You can check out the full [API](https://github.com/nrwl/ci) for those workflows.

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=["9-21"] %}
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    name: Nx Cloud - Main Job
    uses: nrwl/ci/.github/workflows/nx-cloud-main.yml@v0.13.0
    with:
      number-of-agents: 3
      parallel-commands-on-agents: |
        npx nx affected -t lint,test,build,e2e --parallel=2

  agents:
    name: Nx Cloud - Agents
    uses: nrwl/ci/.github/workflows/nx-cloud-agents.yml@v0.13.0
    with:
      number-of-agents: 3
```

This workflow runs all the affected tasks on 3 agents, with 2 tasks running in parallel on each agent.

Try it out by creating a new PR with the above changes.

Once GitHub Actions starts, you should see multiple agents running in parallel:

![GitHub Actions showing multiple DTE agents](/nx-cloud/tutorial/gh-dte-multiple-agents.png)

If you open your Nx Cloud dashboard, you'll get a better view of the individual tasks and their corresponding logs.

![Nx Cloud run details](/nx-cloud/tutorial/nx-cloud-run-details.png)

With this pipeline configuration in place, no matter how large the repository scales, Nx Cloud will adjust and distribute tasks across agents in the optimal way. If CI pipelines start to slow down, just add some agents to the `number-of-agents: 3` properties. One of the main advantages is that such a pipeline definition is declarative. We just give instructions what commands to run, but not how to distribute them. As such even if our monorepo structure changes and evolves over time, the distribution will be taken care of by Nx Cloud.

## Next Steps

You now have a highly optimized CI configuration that will scale as your repository scales. See what else you can do with Nx Cloud.

- Set up [GitHub PR integration](/ci/recipes/source-control-integration/github) to view Nx Cloud results directly in your PR
- Choose the [security settings](/ci/concepts/cache-security) that make sense for your organization
- [Record non-Nx commands](/ci/recipes/other/record-commands) and view the results in the Nx Cloud interface
