import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import AgentCAForm from "./AgentCAForm"

export default async function PageCA() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "AGENT_CA") {
        redirect("/login")
    }

    return <AgentCAForm />
}
