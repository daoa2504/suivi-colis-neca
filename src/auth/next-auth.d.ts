// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

// Aligne les types sur notre RBAC : ADMIN | AGENT_CA | AGENT_GN
type AppRole = "ADMIN" | "AGENT_CA" | "AGENT_GN";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            role: AppRole;
        };
    }

    interface User {
        id: string;
        email: string;
        role: AppRole;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        email: string;
        role: AppRole;
    }
}
