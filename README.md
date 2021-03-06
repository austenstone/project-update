# Update Item Field Projects (BETA) ✏️

This GitHub [action](https://docs.github.com/en/actions) updates item fields on [Projects (beta)](https://github.com/features/issues).

The action is great to use in combination with [project-add](https://github.com/austenstone/project-add) as you will need to obtain the `item-id` to update an item's field.

#### Field Type Support
- Text
- Number
- Date
- Single select
- Iteration

`field-names` are supplied as a CSV list of names.
```yml
          field-names: Status,Iteration,product,priority
```
`field-values` are supplied as a CSV list of corresponding values. 

```yml
          field-values: todo,[0],back-end,high
```
Options and iterations are matched by the name(case-insensitive). You can also use an array index notation. For example `[0]` would be the first option or iteration. The first iteration is always the current one.

## Usage
Create a workflow (eg: `.github/workflows/on-issue-pr-open.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

You will need a project number for input `project-number`. For example [`https://github.com/users/austenstone/projects/`*`5`*](https://github.com/users/austenstone/projects/5) the project number is *`5`*.

You will need to [create a PAT(Personal Access Token)](https://github.com/settings/tokens/new?scopes=admin:org) that has `admin:org` access so we can read/write to the project.

Add this PAT as a secret so we can use it as input `github-token`, see [Creating encrypted secrets for a repository](https://docs.github.com/en/enterprise-cloud@latest/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository).

### Organizations

If your project is part of an organization that has SAML enabled you must authorize the PAT, see [Authorizing a personal access token for use with SAML single sign-on](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on).

#### Example: Add Issues and PRs
```yml
name: "Add Issue/PR to Project"
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]

jobs:
  add_to_project:
    name: Add to Project
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: austenstone/project-add@main
        with:
          user: ${{ github.repository_owner }}
          project-number: 5
          github-token: "${{ secrets.MY_TOKEN }}"
        id: project-add
      - uses: austenstone/project-update@main
        with:
          user: ${{ github.repository_owner }}
          project-number: 5
          github-token: "${{ secrets.MY_TOKEN }}"
          item-id: ${{ steps.project-add.outputs.id }}
          field-names: product,priority
          field-values: back-end,high
```

### Users

For user owned projects you must provide the `user` input in the workflow.

```yml
        with:
          user: ${{ github.repository_owner }}
          github-token: "${{ secrets.MY_TOKEN }}"
          project-number: 1234
```

## Input Settings
Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | - | - |
| **project-number** | The project number. Get this from the URL. | N/A |
| github-token | Token to use to authorize. This should be a personal access token. | ${{&nbsp;github.token&nbsp;}} |
| organization | The organization that owns of the project. | _the repository owner_
| user | The user that owns of the project. | N/A
| **item-id** | The item Id of the issue or pull request. | N/A |
| field-names | CSV fields to modify. | N/A
| field-values | CSV fields values. | N/A

If you are using a user owned project board you must provide the `user` input.<br>`${{ github.repository_owner }}` is fine if you're the owner of the repository.

## Permissions
Until GitHub supports permissions for projects (beta) we will need to [create a PAT(Personal Access Token)](https://github.com/settings/tokens/new?scopes=admin:org) with `admin:org` scope.

Once support is added you we can utilize [Assigning permissions to jobs](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs) and the action will default to the token `${{ github.token }}`.

```yml
permissions:
  repository-projects: write
```

Another option is to use something like [tibdex/github-app-token](https://github.com/tibdex/github-app-token) to get a token during the workflow.

## References
- [Automating projects (beta)](https://docs.github.com/en/enterprise-cloud@latest/issues/trying-out-the-new-projects-experience/automating-projects)
- [Example workflow authenticating with a GitHub App](https://docs.github.com/en/enterprise-cloud@latest/issues/trying-out-the-new-projects-experience/automating-projects#example-workflow-authenticating-with-a-github-app)
