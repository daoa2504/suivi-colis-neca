// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canEdit(role?: string | null) {
    return role === "ADMIN" || role === "AGENT_NE";
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function sendWithRetry(args: Parameters<typeof sendEmailSafe>[0], max = 3) {
    let last: Awaited<ReturnType<typeof sendEmailSafe>> | undefined;
    for (let i = 0; i < max; i++) {
        last = await sendEmailSafe(args);
        if (last.ok) return last;
        const msg = last.error || "";
        if (!/(?:429|rate|throttl|temporar|timeout|5\d\d)/i.test(msg)) break;
        await sleep(600 * (i + 1));
    }
    return last!;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;  // ← AJOUT DE AWAIT
    const id = Number(idStr);

    if (!Number.isInteger(id)) {
        return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const before = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true, trackingId: true, receiverName: true, receiverEmail: true,
            receiverPhone: true, weightKg: true, receiverAddress: true,
            receiverCity: true, receiverPoBox: true, notes: true,
        },
    });
    if (!before) {
        return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
    }

    // whitelist
    const data: any = {};
    if ("receiverName"    in body) data.receiverName    = String(body.receiverName ?? "");
    if ("receiverEmail"   in body) data.receiverEmail   = String(body.receiverEmail ?? "");
    if ("receiverPhone"   in body) data.receiverPhone   = body.receiverPhone ? String(body.receiverPhone) : null;
    if ("weightKg"        in body) data.weightKg        = body.weightKg !== "" && body.weightKg !== undefined ? Number(body.weightKg) : null;
    if ("receiverAddress" in body) data.receiverAddress = body.receiverAddress ? String(body.receiverAddress) : null;
    if ("receiverCity"    in body) data.receiverCity    = body.receiverCity ? String(body.receiverCity) : null;
    if ("receiverPoBox"   in body) data.receiverPoBox   = body.receiverPoBox ? String(body.receiverPoBox) : null;
    if ("notes"           in body) data.notes           = body.notes ? String(body.notes) : null;

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ ok: false, error: "Aucun champ modifiable reçu" }, { status: 400 });
    }

    const updated = await prisma.shipment.update({
        where: { id }, data,
        select: {
            id: true, trackingId: true, receiverName: true, receiverEmail: true,
            receiverPhone: true, weightKg: true, receiverAddress: true,
            receiverCity: true, receiverPoBox: true, notes: true,
        },
    });

    // revalidate
    revalidatePath("/dashboard/shipments");
    revalidatePath(`/dashboard/shipments/${id}/edit`);

    // ------------- EMAIL DEBUG -------------
    const BASE_URL =
        process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "https://nimaplex.com";

    // ⚠️ Fallback FROM test si ton domaine n'est pas encore vérifié
    const FROM_FALLBACK = process.env.RESEND_TEST_FROM || "onboarding@resend.dev";
    const FROM_SAFE = FROM || FROM_FALLBACK;

    const to = (updated.receiverEmail || "").trim();
    const emailTried = !!to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
    let emailResp: { ok?: boolean; id?: string; error?: string } | null = null;

    if (emailTried) {
        const subject = `Mise à jour du colis ${updated.trackingId}`;

        const lines: string[] = [];
        lines.push(`Bonjour ${updated.receiverName || ""}`.trim() + ",", "");
        lines.push("Les informations de votre colis ont été mises à jour :");
        if ("receiverAddress" in data) lines.push(`• Adresse : ${updated.receiverAddress ?? "—"}`);
        if ("receiverCity"    in data) lines.push(`• Ville : ${updated.receiverCity ?? "—"}`);
        if ("receiverPoBox"   in data) lines.push(`• Boîte postale : ${updated.receiverPoBox ?? "—"}`);
        if ("receiverPhone"   in data) lines.push(`• Téléphone : ${updated.receiverPhone ?? "—"}`);
        if ("weightKg"        in data) lines.push(`• Poids : ${updated.weightKg ?? "—"} kg`);
        if ("notes"           in data) lines.push(`• Notes : ${updated.notes ?? "—"}`);
        lines.push("", `Tracking : ${updated.trackingId}`, "", "— Service Suivi NE → CA");

        const text = lines.join("\n");

        const html = `
<div style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
  <p>Bonjour <strong>${updated.receiverName || ""}</strong>,</p>
  <p>Les informations de votre colis ont été mises à jour :</p>
  <ul style="margin:0 0 12px 18px;padding:0;">
    ${("receiverAddress" in data) ? `<li>Adresse : ${updated.receiverAddress ?? "—"}</li>` : ""}
    ${("receiverCity"    in data) ? `<li>Ville : ${updated.receiverCity ?? "—"}</li>` : ""}
    ${("receiverPoBox"   in data) ? `<li>Boîte postale : ${updated.receiverPoBox ?? "—"}</li>` : ""}
    ${("receiverPhone"   in data) ? `<li>Téléphone : ${updated.receiverPhone ?? "—"}</li>` : ""}
    ${("weightKg"        in data) ? `<li>Poids : ${updated.weightKg ?? "—"} kg</li>` : ""}
    ${("notes"           in data) ? `<li>Notes : ${updated.notes ?? "—"}</li>` : ""}
  </ul>
  <p><strong>Tracking :</strong> ${updated.trackingId}</p>
  <p>— Service Suivi <strong>NE → CA</strong></p>
  <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;" />
  <table role="presentation" style="border-collapse:collapse;border-spacing:0;margin-top:6px;">
    <tr>
      <td style="padding:0;">
        <img src="${BASE_URL}/img.png" width="55" height="55" style="display:block;border-radius:6px;" alt="NIMAPLEX" />
      </td><td style="padding:0 0 0 6px;line-height:1.25;">
        <div style="font-weight:bold;color:#8B0000;font-size:15px;">NIMAPLEX</div>
        <div style="font-size:12.5px;color:#555;">Plus qu'une solution, un service d'excellence global</div>
      </td>
    </tr>
  </table>
</div>`.trim();

        const resp = await sendWithRetry({ from: FROM_SAFE, to, subject, text, html }, 3);
        emailResp = { ok: resp.ok, id: resp.id, error: resp.error };
        if (!resp.ok) {
            console.warn("[email:update] provider refused:", resp.error);
        }
    } else {
        console.warn("[email:update] destinataire vide/invalide:", to);
    }
    // ------------- /EMAIL DEBUG -------------

    return NextResponse.json({
        ok: true,
        shipment: updated,
        email: {
            tried: emailTried,
            to,
            from: FROM_SAFE,
            providerOk: emailResp?.ok ?? false,
            providerId: emailResp?.id ?? null,
            providerError: emailResp?.error ?? null,
            hasApiKey: !!process.env.RESEND_API_KEY,
        },
    });
}