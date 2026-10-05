import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        // Logique pure uniquement : pas de navigateur, pas de base de données.
        // C'est ce qui permet au CI de rendre son verdict en quelques secondes.
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
    resolve: {
        // Même alias que tsconfig, sinon les imports "@/lib/..." ne résolvent pas.
        alias: { "@": path.resolve(__dirname, "src") },
    },
});
