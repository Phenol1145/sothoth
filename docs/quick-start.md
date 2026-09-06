# Sothoth Quick Start

This guide is for a human working with an agent. In the first loop, the human supplies the goal and authority; the agent prepares one explicit Sothoth request; Sothoth compiles it deterministically; and the human decides what happens next.

## 1. Install the CLI

Sothoth 0.1.0 requires Node.js `>=22.14.0`. Install the CLI in the project where the agent will use it:

```sh
npm install --save-dev @project-sothoth/cli@0.1.0
npx sothoth --help
```

Installation changes the project's package manifest and lockfile. If the agent is operating the project for you, authorize those exact paths before asking it to install anything. An agent must not install dependencies or use the network merely because the executable is missing.

## 2. Create one explicit request

Start with dependency planning because the request is small and the result is easy to inspect. Create `sothoth-input/planning.json`:

```json
{
  "tasks": [
    { "taskId": "design", "dependsOn": [] },
    { "taskId": "implement", "dependsOn": ["design"] },
    { "taskId": "verify", "dependsOn": ["implement"] }
  ]
}
```

Sothoth does not discover tasks, paths, or dependencies. The values in this request are assertions supplied by you or prepared by your agent for your review.

## 3. Give the agent a bounded instruction

You can copy this prompt and adjust the paths:

> Use Sothoth 0.1.0 to compile the dependency schedule in `./sothoth-input/planning.json`. Write JSON to `./sothoth-output/planning.json`. Do not scan for other inputs, modify Source Facts, install packages, or perform Git or release actions. Before running, confirm the executable and both paths. Afterward, report the exact command, outcome, exit code, diagnostic codes, and output path. Treat a valid result as evidence, not human acceptance.

This prompt gives the agent five things it should never have to guess: version, operation, input, output, and authority.

## 4. Run the compilation

The agent should run the equivalent of:

```sh
npx sothoth compile planning \
  --format json \
  --input ./sothoth-input/planning.json \
  --output ./sothoth-output/planning.json
```

The output directory must already exist. With `--output`, the CLI writes the complete document atomically and leaves stdout empty. Without `--output`, it writes one complete document to stdout.

For the request above, a successful result has outer schema `sothoth.cli/cli-invocation-result@1`, outcome `valid`, exit code `0`, and a digest-bearing three-wave schedule in `result.result`. Do not copy a digest from documentation; use the digest produced from your exact input.

## 5. Decide the next action

Ask the agent to summarize rather than reinterpret the result:

- Which exact input bytes and command were used?
- What outcome and exit code were returned?
- Which Structured Diagnostic codes, subjects, and help entries were produced?
- Where is the complete output document?
- What, if anything, now needs a human decision?

If the result is `valid`, the supplied planning constraints are internally valid. It does not accept a design, authorize an edit, approve a commit, or permit a release. If the result is not `valid`, fix or replace only the input facts that the human has authorized; do not ask the agent to make the checker green by inventing facts.

## Next steps

- Read the [User Guide](user-guide.md) for governance checks, document indexing, change plans, selector use, SDK integration, outcomes, and troubleshooting.
- Give agents the repository's [`using-sothoth` skill](../skills/using-sothoth/SKILL.md).
- Use the [CLI package reference](packages/cli.md) for the frozen command and I/O surface.
- Use the [SDK package reference](packages/sdk.md) when embedding Sothoth in TypeScript.
