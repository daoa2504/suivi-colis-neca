// src/types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
    interface User {
        id: string;
        username: string; // ✅ Ajouté
        email?: string;
        role: string;
    }

    interface Session {
        user: {
            id: string;
            username: string; // ✅ Ajouté
            email?: string;
            role: string;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        username: string; // ✅ Ajouté
        role: string;
    }
}