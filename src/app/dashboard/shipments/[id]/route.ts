// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Utils
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
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    // ✅ SESSION
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user?.role as "ADMIN" | "AGENT_CA" | "AGENT_NE" | undefined;

    // ✅ COLIS AVANT MODIFICATION
    const before = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            receiverPhone: true,
            weightKg: true,
            receiverAddress: true,
            receiverCity: true,
            receiverPoBox: true,
            notes: true,
            originCountry: true, // ✅ OBLIGATOIRE POUR LES PERMISSIONS
        },
    });

    if (!before) {
        return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
    }

    // ✅ ✅ GESTION DES PERMISSIONS (SÉCURITÉ FINALE)
    if (role === "ADMIN") {
        // toujours autorisé
    }
    else if (role === "AGENT_CA" && before.originCountry !== "CA") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    else if (role === "AGENT_NE" && before.originCountry !== "NE") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // ✅ BODY
    const body = await req.json();

    // ✅ WHITELIST DES CHAMPS MODIFIABLES
    const data: any = {};
    if ("receiverName" in body) data.receiverName = String(body.receiverName ?? "");
    if ("receiverEmail" in body) data.receiverEmail = String(body.receiverEmail ?? "");
    if ("receiverPhone" in body) data.receiverPhone = body.receiverPhone ? String(body.receiverPhone) : null;
    if ("weightKg" in body) data.weightKg = body.weightKg !== "" && body.weightKg !== undefined ? Number(body.weightKg) : null;
    if ("receiverAddress" in body) data.receiverAddress = body.receiverAddress ? String(body.receiverAddress) : null;
    if ("receiverCity" in body) data.receiverCity = body.receiverCity ? String(body.receiverCity) : null;
    if ("receiverPoBox" in body) data.receiverPoBox = body.receiverPoBox ? String(body.receiverPoBox) : null;
    if ("notes" in body) data.notes = body.notes ? String(body.notes) : null;

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ ok: false, error: "Aucun champ modifiable reçu" }, { status: 400 });
    }

    // ✅ UPDATE
    const updated = await prisma.shipment.update({
        where: { id },
        data,
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            receiverPhone: true,
            weightKg: true,
            receiverAddress: true,
            receiverCity: true,
            receiverPoBox: true,
            notes: true,
            originCountry: true,
        },
    });

    // ✅ REVALIDATION
    revalidatePath("/dashboard/shipments");
    revalidatePath(`/dashboard/shipments/${id}/edit`);

    // ✅ EMAIL
    const BASE_URL =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.APP_URL ||
        "https://nimaplex.com";

    const FROM_FALLBACK = process.env.RESEND_TEST_FROM || "onboarding@resend.dev";
    const FROM_SAFE = FROM || FROM_FALLBACK;

    const to = (updated.receiverEmail || "").trim();
    const emailTried = !!to && isValidEmail(to);
    let emailResp: { ok?: boolean; id?: string; error?: string } | null = null;

    if (emailTried) {
        const notes =
            updated.notes && String(updated.notes).trim().length > 0
                ? `${String(updated.notes).trim()}\n`
                : "";

        const subject = `Mise à jour • ${updated.trackingId}`;

        const text = `Bonjour ${updated.receiverName || ""},

Les informations de votre colis ont été mises à jour dans notre système.

Numéro ID : ${updated.trackingId}

— Équipe NIMAPLEX`;

        const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">

  <!-- En-tête avec logo -->
  <table role="presentation" style="border-collapse: collapse; border-spacing: 0; margin-bottom: 30px; width: 100%;">
    <tr>
      <td style="padding: 0;">
        <img src="https://nimaplex.com/img.png" alt="NIMAPLEX" width="60" height="60" style="display: block; border-radius: 8px;" />
      </td>
      <td style="padding-left: 12px; line-height: 1.3;">
        <div style="font-weight: 700; color: #8B0000; font-size: 18px; letter-spacing: 0.5px;">MUGRALEX</div>
        <div style="font-size: 13px; color: #6c757d;">Plus qu'une solution, un service d'excellence global</div>
      </td>
    </tr>
  </table>

  <!-- Corps du message -->
  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      Mise à jour de votre colis
    </h2>

    <p style="margin: 0 0 15px 0;">
      Bonjour <strong>${updated.receiverName || ""}</strong>,
    </p>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      Les informations de votre colis ont été mises à jour avec succès dans notre système.
    </p>

    <!-- Encadré du colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Numéro de suivi :</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
            ${updated.trackingId}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Poids :</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
            ${updated.weightKg ?? "—"} Kg
          </td>
        </tr>
      </table>
    </div>

    ${
            notes
                ? `
    <div style="background-color: #fff3cd; border-left: 3px solid #ffc107; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>Note :</strong> ${notes}
      </p>
    </div>
    `
                : ""
        }

    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: justify; text-justify: inter-word;">
      Pour toute question concernant votre colis, n'hésitez pas à nous contacter.
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">Niger → Canada</span>
    </p>

    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>

</div>
`.trim();


        const resp = await sendWithRetry(
            { from: FROM_SAFE, to, subject, text, html },
            3
        );
        emailResp = { ok: resp.ok, id: resp.id, error: resp.error };
    }

    // ✅ RÉPONSE FINALE
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
