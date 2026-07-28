# AGENTS.md Instructions

## Access

- Codex is allowed to inspect all files in this local repository.

## Git Safety

- Do not push to GitHub unless the user explicitly asks.

## Communication

- Before changing files, list the proposed changes in plain-English bullet points.

## Windows Command Rule

This workspace runs in Windows PowerShell with script execution restricted.

Use commands in this order:

1. `node` for Node scripts, for example: `node scripts/example.js`
2. `npm.cmd` for npm, for example: `npm.cmd test`
3. `npx.cmd` for npx, for example: `npx.cmd vercel@latest --version`

Do not use bare `npm` or `npx`, because PowerShell may try to run blocked `.ps1` shims. Do not change the PowerShell execution policy to work around this.

## Project Workflow Objective

- The main workflow objective is to simplify Tree Dude's UI and reduce complexity so the project can reach a prototype version sooner.
