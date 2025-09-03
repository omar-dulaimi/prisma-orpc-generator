# Project Overview

This project is a Prisma generator called `prisma-orpc-generator`. It's a Node.js library written in TypeScript that generates fully-featured, type-safe oRPC (OpenRPC) APIs from a Prisma schema. The generated APIs come with Zod validation and a wide range of features, including middleware, client SDKs, and deployment artifacts.

The project is structured as a monorepo with the core generator logic in the `src` directory and an example project in the `examples` directory. The generator itself is composed of several specialized generators, each responsible for a specific part of the API generation process.

## Building and Running

The project uses `pnpm` for package management. Here are the key commands for building, running, and testing the project:

*   **Install dependencies:**
    ```bash
    pnpm install
    ```
*   **Build the generator:**
    ```bash
    pnpm run build
    ```
*   **Run tests:**
    ```bash
    pnpm test
    ```
*   **Run the basic example:**
    ```bash
    pnpm run example:basic
    ```

## Development Conventions

The project follows standard TypeScript and Node.js development conventions. Here are some of the key conventions used:

*   **Code Style:** The project uses Prettier for code formatting and ESLint for linting.
*   **Testing:** The project uses Vitest for unit and integration testing.
*   **Commit Style:** The project uses Conventional Commits for commit messages.
*   **Branching Strategy:** The project uses a GitFlow branching strategy.
*   **Continuous Integration:** The project uses GitHub Actions for continuous integration.
